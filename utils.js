// Validate and format the balance
const mongoose = require('mongoose');
function formatBalance(balance) {
    // Convert balance to a number
    let parsedBalance = Number(balance);
  
    // Check if the balance is a valid number
    if (isNaN(parsedBalance)) {
      throw new Error('Invalid balance');
    }
  
    // Limit the precision to 4 decimal points
    let formattedBalance = parsedBalance.toFixed(4);
  
    return +formattedBalance;
  }
  function isValidObjectId(param) {
    return mongoose.isValidObjectId(param);
  }
 module.exports ={
    formatBalance,
    isValidObjectId
 }