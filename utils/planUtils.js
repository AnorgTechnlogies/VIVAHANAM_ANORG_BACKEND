// utils/planUtils.js
export const PLAN_CREDITS = {
    STARTER: 10,
    STANDARD: 25,
    PREMIUM: 60,
    FAMILY: 300,
    SILVER: 50,
    GOLD: 100,
    PLATINUM: 200,
    DIAMOND: 500,
    PAYASGO: 0,
  };
  
  export const getCreditsForPlan = (planCode) => {
    return PLAN_CREDITS[planCode.toUpperCase()] || 0;
  };
  
  export const calculateExpiryDate = (planCode) => {
    const validityDays = {
      STARTER: 60,
      STANDARD: 120,
      PREMIUM: 180,
      FAMILY: 365,
      SILVER: 30,
      GOLD: 60,
      PLATINUM: 90,
      DIAMOND: 365,
      PAYASGO: null,
    };
    
    const days = validityDays[planCode.toUpperCase()];
    if (!days) return null;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
  };