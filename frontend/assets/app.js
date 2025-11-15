// Configuration
const BACKEND_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000' 
  : '/api';

// Global state
let stripe;
let customerId = localStorage.getItem('customerId') || null;
let subscriptionId = localStorage.getItem('subscriptionId') || null;
let paymentRequest;
let publishableKey;

// DOM Elements
const startTrialBtn = document.getElementById('startTrialBtn');
const cancelTrialBtn = document.getElementById('cancelTrialBtn');
const cancelSubBtn = document.getElementById('cancelSubBtn');
const refundBtn = document.getElementById('refundBtn');
const messageDisplay = document.getElementById('message');
const customerIdDisplay = document.getElementById('customerIdDisplay');
const subscriptionIdDisplay = document.getElementById('subscriptionIdDisplay');
const cardFallbackDiv = document.getElementById('stripe-card-fallback');
const cardSubmitBtn = document.getElementById('cardSubmitBtn');
const emailInput = document.getElementById('email-input');
const emailError = document.getElementById('email-error');
const cardError = document.getElementById('card-error');
const userInfoPanel = document.getElementById('userInfoPanel');
const managementActions = document.getElementById('managementActions');

// Drawer elements
const applePayDrawer = document.getElementById('applePayDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const continueApplePayBtn = document.getElementById('continueApplePayBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');

// Drawer Functions
function openDrawer() {
    if (applePayDrawer) {
        applePayDrawer.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeDrawer() {
    if (applePayDrawer) {
        applePayDrawer.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close drawer when clicking backdrop
if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeDrawer);
}

// Close drawer button
if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeDrawer);
}

// Update UI function
async function updateUI(msg, type = 'info') {
    if (messageDisplay) {
        messageDisplay.textContent = msg;
        messageDisplay.className = `message-message ${type}`;
        
        const messageContainer = document.getElementById('message-container');
        if (messageContainer && !msg) {
            messageContainer.style.display = 'none';
        } else if (messageContainer) {
            messageContainer.style.display = 'block';
        }
    }
    
    if (customerIdDisplay) {
        customerIdDisplay.textContent = customerId || 'N/A';
    }
    if (subscriptionIdDisplay) {
        subscriptionIdDisplay.textContent = subscriptionId || 'N/A';
    }

    const isActive = customerId && subscriptionId;
    
    if (cancelTrialBtn) cancelTrialBtn.disabled = !isActive;
    if (cancelSubBtn) cancelSubBtn.disabled = !isActive;
    if (refundBtn) refundBtn.disabled = !isActive;
    
    if (startTrialBtn) {
        startTrialBtn.disabled = isActive;
    }

    if (userInfoPanel) {
        if (isActive) {
            userInfoPanel.style.display = 'block';
            if (managementActions) managementActions.style.display = 'flex';
        } else {
            userInfoPanel.style.display = 'none';
            if (managementActions) managementActions.style.display = 'none';
        }
    }

    // Check Apple Pay availability
    if (paymentRequest) {
        const result = await paymentRequest.canMakePayment();
        const isApplePayAvailable = result && result.applePay;
        if (!isApplePayAvailable && !isActive && cardFallbackDiv) {
            cardFallbackDiv.style.display = 'block';
        } else if (cardFallbackDiv && isActive) {
            cardFallbackDiv.style.display = 'none';
        }
    }
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Complete trial process
async function completeTrialProcess(paymentMethodId, email) {
    try {
        const endpoint = BACKEND_URL.startsWith('http') 
            ? `${BACKEND_URL}/api/start-trial`
            : `${BACKEND_URL}/start-trial`;
            
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentMethodId: paymentMethodId,
                email: email || 'user@example.com',
            }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || data.error || 'Failed to start trial on backend.');
        }

        customerId = data.customerId;
        subscriptionId = data.subscriptionId;
        localStorage.setItem('customerId', customerId);
        localStorage.setItem('subscriptionId', subscriptionId);

        const trialEndDate = new Date(data.trialEnd * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        updateUI(`Trial started successfully! Subscription ID: ${subscriptionId}. Status: ${data.status}. Trial ends: ${trialEndDate}`, 'success');
        
    } catch (error) {
        throw error;
    }
}

// Initialize configuration and PaymentRequest
async function fetchConfig() {
    try {
        const endpoint = BACKEND_URL.startsWith('http') 
            ? `${BACKEND_URL}/api/config`
            : `${BACKEND_URL}/config`;
            
        const response = await fetch(endpoint);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch config');
        }
        
        publishableKey = data.publishableKey;
        
        if (!publishableKey) {
            throw new Error('Public key missing from backend config.');
        }

        stripe = Stripe(publishableKey);

        // Create PaymentRequest for Apple Pay
        paymentRequest = stripe.paymentRequest({
            country: 'US',
            currency: 'usd',
            total: {
                label: 'Premium Subscription',
                amount: 0, // $0 initial charge for trial
            },
            displayItems: [
                {
                    label: '7-Day Free Trial',
                    amount: 0,
                },
                {
                    label: 'Then $39.99/month',
                    amount: 3999,
                },
            ],
            requestPayerName: true,
            requestPayerEmail: true,
        });

        // Check if Apple Pay is available
        const result = await paymentRequest.canMakePayment();

        if (result && result.applePay) {
            console.log('✅ Apple Pay is available!');
            
            // Enable "Continue with Apple Pay" button in drawer
            if (continueApplePayBtn) {
                continueApplePayBtn.disabled = false;
            }
            
        } else {
            console.log('❌ Apple Pay not available');
            // Show card fallback
            if (cardFallbackDiv) {
                cardFallbackDiv.style.display = 'block';
                initializeCardFallback();
            }
            // Disable Apple Pay button in drawer
            if (continueApplePayBtn) {
                continueApplePayBtn.disabled = true;
                continueApplePayBtn.textContent = 'Apple Pay Not Available';
            }
        }

    } catch (error) {
        updateUI(`Error fetching config: ${error.message}`, 'error');
        console.error('Config Error:', error);
    }
    
    if (!customerId || !subscriptionId) {
        updateUI('Ready to start your free trial.');
    }
}

// Handle "Start Free Trial" button - opens custom drawer
if (startTrialBtn) {
    startTrialBtn.addEventListener('click', async () => {
        if (customerId && subscriptionId) {
            updateUI('You already have an active subscription.', 'warning');
            return;
        }
        
        // Check if Apple Pay is available
        if (paymentRequest) {
            try {
                const result = await paymentRequest.canMakePayment();
                if (result && result.applePay) {
                    // Open custom drawer that looks like Apple Pay sheet
                    openDrawer();
                } else {
                    // Show card form directly
                    if (cardFallbackDiv) {
                        cardFallbackDiv.style.display = 'block';
                        initializeCardFallback();
                    }
                    updateUI('Apple Pay is not available. Please use the card form below.', 'warning');
                }
            } catch (error) {
                console.error('Error checking Apple Pay:', error);
                if (cardFallbackDiv) {
                    cardFallbackDiv.style.display = 'block';
                    initializeCardFallback();
                }
            }
        } else {
            // If PaymentRequest not initialized, show card form
            if (cardFallbackDiv) {
                cardFallbackDiv.style.display = 'block';
                initializeCardFallback();
            }
        }
    });
}

// Handle "Continue with Apple Pay" button in drawer - opens real Apple Pay sheet
if (continueApplePayBtn) {
    continueApplePayBtn.addEventListener('click', async () => {
        if (!paymentRequest || !stripe) {
            updateUI('Apple Pay is not initialized.', 'error');
            closeDrawer();
            return;
        }

        try {
            // Close the custom drawer first
            closeDrawer();
            
            // Wait a moment for drawer to close
            await new Promise(resolve => setTimeout(resolve, 200));
            
            updateUI('Opening Apple Pay...', 'info');

            // Verify Apple Pay is still available before showing
            const canPay = await paymentRequest.canMakePayment();
            if (!canPay || !canPay.applePay) {
                updateUI('Apple Pay is no longer available. Please use the card form below.', 'error');
                if (cardFallbackDiv) {
                    cardFallbackDiv.style.display = 'block';
                    initializeCardFallback();
                }
                return;
            }

            // Set up event handlers BEFORE showing the real Apple Pay sheet
            const paymentPromise = new Promise((resolve, reject) => {
                // Remove existing listeners
                paymentRequest.off('paymentmethod');
                paymentRequest.off('cancel');
                
                // Handle successful payment
                paymentRequest.on('paymentmethod', async (event) => {
                    try {
                        updateUI('Processing payment...', 'info');
                        
                        // Complete trial process with backend
                        await completeTrialProcess(
                            event.paymentMethod.id, 
                            event.payerEmail || event.payerName || 'user@example.com'
                        );
                        
                        // Tell Stripe the payment was successful
                        event.complete('success');
                        resolve({ paymentMethod: event.paymentMethod });
                    } catch (error) {
                        // Tell Stripe the payment failed
                        event.complete('fail');
                        
                        let errorMessage = error.message || 'Payment failed';
                        if (errorMessage.includes('real card') || errorMessage.includes('testing') || errorMessage.includes('declined')) {
                            errorMessage = 'Test Mode: Real cards are not accepted. Please use a test card (4242 4242 4242 4242) or add a test card to Apple Pay.';
                        }
                        
                        updateUI(`Payment Error: ${errorMessage}`, 'error');
                        reject(error);
                    }
                });

                // Handle cancellation
                paymentRequest.on('cancel', () => {
                    updateUI('Payment was cancelled.', 'warning');
                    resolve({ error: { message: 'Cancelled' } });
                });
            });

            // Show REAL Apple Pay sheet IMMEDIATELY - this is the native Apple Pay sheet
            paymentRequest.show().catch((error) => {
                console.error('Error showing Apple Pay sheet:', error);
                updateUI(`Unable to show Apple Pay: ${error.message}. Please use the card form below.`, 'error');
                if (cardFallbackDiv) {
                    cardFallbackDiv.style.display = 'block';
                    initializeCardFallback();
                }
            });
            
            // Wait for user to complete or cancel payment
            const result = await paymentPromise;
            
            if (result.error) {
                // User cancelled - no error needed
                return;
            }
            
        } catch (error) {
            console.error('Apple Pay Error:', error);
            let errorMessage = error.message || 'Payment failed';
            if (errorMessage.includes('real card') || errorMessage.includes('testing') || errorMessage.includes('declined')) {
                errorMessage = 'Test Mode: Real cards are not accepted. Please use a test card (4242 4242 4242 4242) or add a test card to Apple Pay.';
            }
            updateUI(`Payment Error: ${errorMessage}`, 'error');
            
            // Show card fallback on error
            if (cardFallbackDiv) {
                cardFallbackDiv.style.display = 'block';
                initializeCardFallback();
            }
        }
    });
}

// Initialize card fallback form
let cardElement;
let elements;

async function initializeCardFallback() {
    if (!stripe) return;
    
    try {
        elements = stripe.elements();
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '17px',
                    color: '#000000',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    '::placeholder': {
                        color: '#8e8e93',
                    },
                },
                invalid: {
                    color: '#ff3b30',
                },
            },
        });
        
        const cardContainer = document.getElementById('card-element');
        if (cardContainer) {
            cardElement.mount('#card-element');
            
            cardElement.on('change', (event) => {
                if (event.error) {
                    if (cardError) {
                        cardError.textContent = event.error.message;
                    }
                } else {
                    if (cardError) {
                        cardError.textContent = '';
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error initializing card element:', error);
    }
}

// Card submit button
if (cardSubmitBtn) {
    cardSubmitBtn.addEventListener('click', async () => {
        if (!stripe || !cardElement) {
            return updateUI('Stripe card element not initialized.', 'error');
        }

        if (emailError) emailError.textContent = '';
        if (cardError) cardError.textContent = '';

        const email = emailInput ? emailInput.value.trim() : '';
        if (!email) {
            if (emailError) {
                emailError.textContent = 'Please enter your email address';
            }
            if (emailInput) emailInput.focus();
            return;
        }

        if (!validateEmail(email)) {
            if (emailError) {
                emailError.textContent = 'Please enter a valid email address';
            }
            if (emailInput) emailInput.focus();
            return;
        }

        cardSubmitBtn.disabled = true;
        cardSubmitBtn.textContent = 'Processing...';
        updateUI('Processing payment...', 'info');

        try {
            const { error: submitError, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (submitError) {
                if (cardError) {
                    cardError.textContent = submitError.message;
                }
                cardSubmitBtn.disabled = false;
                cardSubmitBtn.textContent = 'Start Free Trial';
                return;
            }
            
            await completeTrialProcess(paymentMethod.id, email);
            cardSubmitBtn.disabled = false;
            cardSubmitBtn.textContent = 'Start Free Trial';

        } catch (error) {
            cardSubmitBtn.disabled = false;
            cardSubmitBtn.textContent = 'Start Free Trial';
            updateUI(`Payment Error: ${error.message}`, 'error');
            console.error('Card Submission Error:', error);
        }
    });
}

// Cancel Trial Handler
if (cancelTrialBtn) {
    cancelTrialBtn.addEventListener('click', async () => {
        if (!subscriptionId) return updateUI('No active subscription ID found.', 'warning');
        
        if (!confirm('Are you sure you want to IMMEDIATELY cancel the Free Trial? You will not be charged.')) return;

        try {
            updateUI('Cancelling free trial...', 'info');

            const endpoint = BACKEND_URL.startsWith('http') 
                ? `${BACKEND_URL}/api/cancel-trial`
                : `${BACKEND_URL}/cancel-trial`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId }),
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error?.message || data.error || 'Failed to cancel trial.');

            localStorage.removeItem('subscriptionId');
            subscriptionId = null;
            
            updateUI(`Free Trial Cancelled! Status: ${data.status}. You will not be charged.`, 'success');
            
        } catch (error) {
            updateUI(`Error: ${error.message}`, 'error');
            console.error('Cancel Trial Error:', error);
        }
    });
}

// Cancel Subscription Handler
if (cancelSubBtn) {
    cancelSubBtn.addEventListener('click', async () => {
        if (!subscriptionId) return updateUI('No active subscription ID found.', 'warning');
        
        if (!confirm('Are you sure you want to cancel the PAID subscription at the end of the current billing period?')) return;
        
        try {
            updateUI('Cancelling subscription at period end...', 'info');

            const endpoint = BACKEND_URL.startsWith('http') 
                ? `${BACKEND_URL}/api/cancel-subscription`
                : `${BACKEND_URL}/cancel-subscription`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId }),
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error?.message || data.error || 'Failed to cancel subscription.');

            updateUI(`Subscription scheduled for cancellation. Access valid until: ${new Date(data.currentPeriodEnd * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 'success');
            
        } catch (error) {
            updateUI(`Error: ${error.message}`, 'error');
            console.error('Cancel Subscription Error:', error);
        }
    });
}

// Refund Handler
if (refundBtn) {
    refundBtn.addEventListener('click', async () => {
        if (!customerId) return updateUI('No customer ID found to process refund.', 'warning');
        
        if (!confirm('Are you sure you want to issue a refund for the latest charge?')) return;
        
        try {
            updateUI('Issuing refund...', 'info');

            const endpoint = BACKEND_URL.startsWith('http') 
                ? `${BACKEND_URL}/api/refund`
                : `${BACKEND_URL}/refund`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });

            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error?.message || data.error || 'Failed to issue refund.');

            updateUI(`Refund successful! Amount: $${(data.amountRefunded / 100).toFixed(2)}`, 'success');
            
        } catch (error) {
            updateUI(`Error: ${error.message}`, 'error');
            console.error('Refund Error:', error);
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();
    updateUI('Loading...');
    
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) {
        messageContainer.style.display = 'none';
    }
    
    if (customerId && subscriptionId) {
        updateUI('');
    }
});
