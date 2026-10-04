// مولفه PayPalButton
const PAYPAL_RECEIVER_EMAIL = "sobhan.ganji@icloud.com";
const PAYPAL_ME_LINK = "paypal.me/ganjisobhan";
const APP_BASE_URL = "https://mrjudge.com"; // دامنه اپ

// هنگام کلیک روی پکیج:
function handleBuyCredits(package) {
  // ساخت لینک پرداخت مستقیم به PayPal.me
  const amount = package.price; // مثلا 4.99
  const returnUrl = `${APP_BASE_URL}/credits?success=1&package=${package.id}&amount=${amount}`;
  
  // یا استفاده از PayPal Smart Buttons با receiver email
  window.paypal.Buttons({
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: { value: amount },
          payee: { email_address: "sobhan.ganji@icloud.com" } // گیرنده پرداخت
        }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        // پرداخت موفق - اضافه کردن کردیت به کاربر
        window.location.href = returnUrl;
      });
    }
  }).render('#paypal-button-container');
}

// روش جایگزین با PayPal.me (بسیار سادهتر، بدون SDK):
function handleBuyWithPayPalMe(package) {
  const amount = package.price.toFixed(2);
  window.location.href = `https://paypal.me/ganjisobhan/${amount}`;
  // بعد از پرداخت، کاربر دستی برمیگردد به اپ
}