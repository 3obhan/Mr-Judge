import React from 'react';
import { Button } from "@/components/ui/button";
import { ExternalLink } from 'lucide-react';

/**
 * PayPalButton Component
 * PayPal payment button for purchasing dispute analysis credits
 */
export default function PayPalButton({ amount = "1.00", itemName = "5 Dispute Analysis Credits", returnUrl }) {
  const paypalEmail = "Sobhan.Ganji@iCloud.Com";
  
  // Construct PayPal payment URL
  const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalEmail)}&item_name=${encodeURIComponent(itemName)}&amount=${amount}&currency_code=USD&return=${encodeURIComponent(returnUrl)}&cancel_return=${encodeURIComponent(window.location.origin)}`;

  const handlePayment = () => {
    window.location.href = paypalUrl;
  };

  return (
    <Button
      onClick={handlePayment}
      size="lg"
      className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base shadow-lg hover:shadow-xl transition-all duration-300"
    >
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.15a.806.806 0 01-.795.68H7.72a.483.483 0 01-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502z"/>
        <path d="M2.197 21.99a.483.483 0 01-.476-.558L4.184 7.43a.965.965 0 01.951-.81h4.598c1.873 0 3.193.364 4.016 1.12.44.404.718.916.86 1.554a6.52 6.52 0 01.067 1.742c-.78 3.943-3.437 5.293-6.849 5.293h-.972c-.226 0-.423.166-.46.39l-.59 3.743a.483.483 0 01-.476.408H2.197z"/>
      </svg>
      Pay $1.00 with PayPal
      <ExternalLink className="w-4 h-4 ml-2" />
    </Button>
  );
}