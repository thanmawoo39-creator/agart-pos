import fs from 'fs';
import path from 'path';

// Translation keys that need Myanmar translation
const translationKeys = {
  "app": {
    "name": "Agart POS",
    "tagline": "Point of Sale"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "sales": "Sales (POS)",
    "inventory": "Inventory",
    "customers": "Customers",
    "ledger": "Ledger",
    "reports": "Reports",
    "expenses": "Expenses",
    "settings": "Settings"
  },
  "cart": {
    "title": "Cart",
    "empty": "Cart is empty",
    "quantity": "Quantity",
    "price": "Price",
    "total": "Total",
    "subtotal": "Subtotal",
    "tax": "Tax",
    "grandTotal": "Grand Total",
    "addItem": "Add Item",
    "removeItem": "Remove",
    "updateQuantity": "Update Quantity",
    "paymentMethod": "Payment Method",
    "selectPayment": "Select Payment Method",
    "cash": "Cash",
    "mobile": "Mobile Payment",
    "credit": "Credit",
    "completeSale": "Complete Sale",
    "processing": "Processing...",
    "saleCompleted": "Sale Completed Successfully!",
    "saleId": "Sale #",
    "openShift": "Open Shift",
    "closeShift": "Close Shift",
    "shiftNotOpen": "Your shift is not open",
    "openShiftFirst": "Please open your shift first",
    "selectCustomer": "Select Customer",
    "noCustomerSelected": "No customer selected",
    "customerRequired": "Customer required for credit sales"
  },
  "shift": {
    "management": "Shift Management",
    "overview": "Shift Overview",
    "currentShift": "Current Shift",
    "noActiveShift": "No Active Shift",
    "openShiftToStart": "Open a shift to start tracking sales and managing cash transactions",
    "openingCash": "Opening Cash Amount",
    "enterOpeningCash": "Enter opening cash amount",
    "opening": "Opening",
    "closing": "Closing",
    "staff": "Staff",
    "started": "Started",
    "status": "Status",
    "open": "Open",
    "closed": "Closed",
    "active": "Active",
    "yourShift": "Your Shift",
    "viewOnly": "View Only",
    "closeYourShift": "Close Your Shift",
    "cashCount": "Cash Count",
    "actualCashInHand": "Actual Cash in Hand",
    "enterActualCash": "Enter actual cash amount",
    "expectedCash": "Expected Cash",
    "actualCash": "Actual Cash",
    "discrepancy": "Discrepancy",
    "confirmClose": "Confirm Close",
    "cancel": "Cancel",
    "shiftSummary": "Shift Summary",
    "cashSales": "Cash Sales",
    "totalTransactions": "Total Transactions",
    "perfectBalance": "Perfect Balance!",
    "discrepancyAlert": "Shift Closed with Discrepancy!",
    "alertCreated": "An alert has been created for management"
  },
  "virtualCFO": {
    "title": "Virtual CFO - Business Advisor",
    "placeholder": "Ask about your business finances...",
    "example": "e.g., How can I reduce expenses?",
    "noMessages": "No messages yet. Start by asking a question!",
    "thinking": "AI is thinking...",
    "todayProfit": "Today's Net Profit",
    "inventoryAdvice": "Inventory Advice",
    "collectingData": "Collecting more data for accurate predictions"
  },
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "remove": "Remove",
    "search": "Search",
    "filter": "Filter",
    "sort": "Sort",
    "date": "Date",
    "time": "Time",
    "amount": "Amount",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "address": "Address",
    "description": "Description",
    "notes": "Notes",
    "yes": "Yes",
    "no": "No",
    "ok": "OK",
    "close": "Close",
    "open": "Open",
    "view": "View",
    "details": "Details",
    "actions": "Actions",
    "status": "Status",
    "active": "Active",
    "inactive": "Inactive",
    "enabled": "Enabled",
    "disabled": "Disabled"
  }
};

// Function to generate Myanmar translations using Gemini AI
async function generateMyanmarTranslations() {
  try {
    // Flatten all translation keys and values
    const flattenedKeys = [];
    const flattenObject = (obj, prefix = '') => {
      for (const key in obj) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          flattenObject(obj[key], newKey);
        } else {
          flattenedKeys.push({ key: newKey, english: obj[key] });
        }
      }
    };
    
    flattenObject(translationKeys);
    
    // Create prompt for Gemini
    const prompt = `Translate the following English retail and business terms to natural Myanmar (Burmese) language. These are for a Point of Sale (POS) system used in retail shops in Myanmar. Use appropriate Myanmar retail terminology that shopkeepers and customers would naturally use.

IMPORTANT REQUIREMENTS:
1. Use natural Myanmar terms used in retail/business contexts
2. For "Total" use "စုစုပေါင်း" (common in retail)
3. For "Shift" use "အလုပ်သိမ်း" (work shift)
4. For "I.O.U." use "ချေးစား" (credit note)
5. For "Cart" use "ခြင်းတောင်း" (shopping basket)
6. For "Cash" use "ငွေသား" (physical cash)
7. For "Credit" use "ချေးငွေ" (credit money)
8. For "Mobile Payment" use "မိုဘိုင်းငွေပေးချေမှု" (mobile money payment)
9. Keep translations concise and practical for UI
10. Use modern Myanmar business terminology

Return the response as a valid JSON object with the same structure as the input. Only return the JSON, no additional text.

Input JSON structure:
${JSON.stringify(translationKeys, null, 2)}`;

    console.log('Generating Myanmar translations with Gemini AI...');
    
    // Call Gemini API
    const response = await fetch('http://localhost:5000/api/gemini/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: prompt
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get translations from Gemini');
    }

    const result = await response.json();
    
    // Extract JSON from the response
    let myanmarTranslations;
    try {
      // Try to parse the response as JSON directly
      myanmarTranslations = JSON.parse(result.answer);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the response
      const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        myanmarTranslations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract JSON from Gemini response');
      }
    }

    // Write the translations to file
    const outputPath = path.join(process.cwd(), 'src/i18n/locales/my.json');
    fs.writeFileSync(outputPath, JSON.stringify(myanmarTranslations, null, 2));
    
    console.log('✅ Myanmar translations generated successfully!');
    console.log(`📁 Saved to: ${outputPath}`);
    
    return myanmarTranslations;
    
  } catch (error) {
    console.error('❌ Error generating Myanmar translations:', error);
    
    // Fallback to basic translations if Gemini fails
    console.log('🔄 Using fallback translations...');
    const fallbackTranslations = {
      "app": {"name": "အဂါ့ POS", "tagline": "ရောင်းဝယ်စနစ်"},
      "navigation": {"dashboard": "ဒက်ရှ်ဘုတ်", "sales": "ရောင်းအား (POS)", "inventory": "စတိုးခန်း", "customers": "ဖောက်သည်များ", "ledger": "စာရင်း", "reports": "အစီရင်ခံစာများ", "expenses": "ကုန်ကျစရိတ်များ", "settings": "ဆက်တင်များ"},
      "cart": {"title": "ခြင်းတောင်း", "empty": "ခြင်းတောင်းဗလာဖြစ်နေပါသည်", "quantity": "အရေအတွက်", "price": "စျေးနှုန်း", "total": "စုစုပေါင်း", "subtotal": "ခွဲစိတ်ပေါင်း", "tax": "အခွန်", "grandTotal": "စုစုပေါင်းစျေးနှုန်း", "addItem": "ပစ္စည်းထည့်ပါ", "removeItem": "ဖြုတ်ပါ", "updateQuantity": "အရေအတွက်ပြောင်းပါ", "paymentMethod": "ငွေပေးချေမှုနည်းလမ်း", "selectPayment": "ငွေပေးချေမှုနည်းလမ်းရွေးပါ", "cash": "ငွေသား", "mobile": "မိုဘိုင်းငွေပေးချေမှု", "credit": "ချေးငွေ", "completeSale": "ရောင်းပြီးမြောက်ပါ", "processing": "ဆောင်ရွက်နေသည်...", "saleCompleted": "ရောင်းချမှုအောင်မြင်ပါသည်!", "saleId": "ရောင်းချမှု #", "openShift": "အလုပ်သိမ်းစတင်ပါ", "closeShift": "အလုပ်သိမ်းပိတ်ပါ", "shiftNotOpen": "သင့်အလုပ်သိမ်းမဖွင့်ရသေးပါ", "openShiftFirst": "ဦးစွာသင့်အလုပ်သိမ်းကိုဖွင့်ပါ", "selectCustomer": "ဖောက်သည်ရွေးပါ", "noCustomerSelected": "ဖောက်သည်မရွေးချယ်ထားပါ", "customerRequired": "ချေးငွေရောင်းချမှုအတွက်ဖောက်သည်လိုအပ်ပါသည်"},
      "shift": {"management": "အလုပ်သိမ်းစီမံခန့်ခွဲမှု", "overview": "အလုပ်သိမ်းအကျဉ်းချုပ်", "currentShift": "လက်ရှိအလုပ်သိမ်း", "noActiveShift": "တက်ကြွနေသောအလုပ်သိမ်းမရှိပါ", "openShiftToStart": "ရောင်းအားနှင့်ငွေစာရင်းများကိုစောင့်ကြည့်ရန်အလုပ်သိမ်းဖွင့်ပါ", "openingCash": "အလုပ်သိမ်းစတင်ငွေ", "enterOpeningCash": "အလုပ်သိမ်းစတင်ငွေထည့်ပါ", "opening": "စတင်ခြင်း", "closing": "ပိတ်ခြင်း", "staff": "ဝန်ထမ်း", "started": "စတင်ခဲ့သည်", "status": "အခြေအနေ", "open": "ဖွင့်ထားသည်", "closed": "ပိတ်ထားသည်", "active": "တက်ကြွနေသည်", "yourShift": "သင့်အလုပ်သိမ်း", "viewOnly": "ကြည့်ရှုရန်သာ", "closeYourShift": "သင့်အလုပ်သိမ်းပိတ်ပါ", "cashCount": "ငွေရေတွက်ခြင်း", "actualCashInHand": "လက်ဝယ်ရှိသောအမှန်တကယ်ငွေ", "enterActualCash": "အမှန်တကယ်ငွေပမာဏထည့်ပါ", "expectedCash": "မျှော်လင့်ထားသောငွေ", "actualCash": "အမှန်တကယ်ငွေ", "discrepancy": "ကွာခြားချက်", "confirmClose": "ပိတ်ကြောင်းအတည်ပြုပါ", "cancel": "ပယ်ဖျက်ပါ", "shiftSummary": "အလုပ်သိမ်းအကျဉ်းချုပ်", "cashSales": "ငွေသားရောင်းအား", "totalTransactions": "စုစုပေါင်းအရောင်းအဝယ်အရေအတွက်", "perfectBalance": "ပြည့်ဝသောလက်ငင်!", "discrepancyAlert": "အလုပ်သိမ်းကွာခြားချက်ဖြင့်ပိတ်ပါသည်!", "alertCreated": "စီမံခန့်ခွဲမှုအတွက်သတိပေးချက်တစ်ခုဖန်တီးပြီးပါသည်"},
      "virtualCFO": {"title": "ဒေါ်လာ CFO - စီးပွားရေးအကြံပေး", "placeholder": "သင့်စီးပွားရေးဘဏ္ဍာရေးအကြောင်းမေးပါ...", "example": "ဥပမာ၊ ကုန်ကျစရိတ်များကိုဘယ်လိုလျှော့ချမလဲ?", "noMessages": "မက်ဆေ့ချ်မရှိပါ။ မေးခွန်းတစ်ခုမေးပြီးစတင်ပါ!", "thinking": "AI စဉ်းစားနေသည်...", "todayProfit": "ယနေ့စုစုပေါင်းအမြတ်ငွေ", "inventoryAdvice": "စတိုးခန်းအကြံပေးချက်", "collectingData": "တိကျသောခန့်မှန်းချက်များအတွက်နောက်ထပ်ဒေတာစုဆောင်းနေသည်"},
      "common": {"loading": "ဆောင်ရွက်နေသည်...", "error": "အမှား", "success": "အောင်မြင်မှု", "save": "သိမ်းဆည်းပါ", "cancel": "ပယ်ဖျက်ပါ", "delete": "ဖျက်ပါ", "edit": "ပြင်ဆင်ပါ", "add": "ထည့်ပါ", "remove": "ဖြုတ်ပါ", "search": "ရှာဖွေပါ", "filter": "စိစစ်ပါ", "sort": "စီစဉ်ပါ", "date": "ရက်စွဲ", "time": "အချိန်", "amount": "ပမာဏ", "name": "အမည်", "email": "အီးမေးလ်", "phone": "ဖုန်း", "address": "လိပ်စာ", "description": "ဖော်ပြချက်", "notes": "မှတ်ချက်များ", "yes": "ဟုတ်ကဲ့", "no": "မဟုတ်ပါ", "ok": "ကောင်းပီး", "close": "ပိတ်ပါ", "open": "ဖွင့်ပါ", "view": "ကြည့်ပါ", "details": "အသေးစိတ်", "actions": "လုပ်ငန်းများ", "status": "အခြေအနေ", "active": "တက်ကြွနေသည်", "inactive": "ရပ်တန့်နေသည်", "enabled": "ဖွင့်ထားသည်", "disabled": "ပိတ်ထားသည်"}
    };
    
    const outputPath = path.join(process.cwd(), 'src/i18n/locales/my.json');
    fs.writeFileSync(outputPath, JSON.stringify(fallbackTranslations, null, 2));
    
    console.log('✅ Fallback Myanmar translations saved!');
    return fallbackTranslations;
  }
}

// Run the translation generation
generateMyanmarTranslations().catch(console.error);
