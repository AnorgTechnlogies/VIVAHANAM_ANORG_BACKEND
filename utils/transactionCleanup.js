// utils/transactionCleanup.js
export const cleanupStuckTransactions = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const result = await Transaction.updateMany(
      {
        status: { $in: ['CREATED', 'PENDING', 'INITIATED'] },
        createdAt: { $lt: thirtyMinutesAgo },
        paymentGateway: 'PAYPAL'
      },
      {
        status: 'EXPIRED',
        failureReason: 'Transaction timed out - automatic cleanup'
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} stuck transactions`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Transaction cleanup error:', error);
    return 0;
  }
};

// Run cleanup every hour
setInterval(cleanupStuckTransactions, 60 * 60 * 1000);