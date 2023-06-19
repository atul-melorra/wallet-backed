const express = require("express");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { formatBalance, isValidObjectId } = require("../utils");
const { default: mongoose } = require("mongoose");
const router = express.Router();

// Initialize wallet
router.post("/setup", async (req, res) => {
  try {
    const { balance, name } = req.body;
    // Format the balance
    const formattedBalance = formatBalance(balance);

    const wallet = new Wallet({ balance: formattedBalance, name });
    await wallet.save();
    res.status(200).json({
      id: wallet._id,
      balance: wallet.balance,
      name: wallet.name,
      date: wallet.date,
    });
  } catch (error) {
    console.error("Error initializing wallet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Credit/Debit amount
router.post("/transact/:walletId", async (req, res) => {
  const MAX_RETRY_ATTEMPTS = 3;
  let retryCount = 0;
  const performTransaction = async () => {
    try {
      const session = await mongoose.startSession();
      session.startTransaction();
      const { walletId } = req.params;
      const { amount, description, version } = req.body;
      const type = amount >= 0 ? "CREDIT" : "DEBIT";

      // Fetch the wallet and update
      const updatedWallet = await Wallet.findOneAndUpdate(
        { _id: walletId, version: version },
        { $inc: { balance: amount, version: 1 } },
        { new: true, session }
      );

      if (!updatedWallet) {
        return res.status(404).json({ error: "Wallet not found or version mismatch" });
      }
      // Perform credit or debit transaction
      const transaction = new Transaction({
        walletId,
        amount: formatBalance(amount),
        description,
        balance: formatBalance(updatedWallet.balance) + formatBalance(amount),
        type: type,
      });

      await transaction.save({ session });
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        balance: updatedWallet.balance,
        transactionId: transaction._id,
      });
    } catch (error) {
      if (error.name === 'MongoError' && error.code === 112) {
        // WriteConflict error occurred, retry the transaction
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          retryCount++;
          await performTransaction();
        } else {
          console.error('Maximum retry attempts reached');
          res.status(500).json({ error: 'Transaction failed due to concurrency' });
        }
      } else {
        console.error('Error performing transaction:', error);
        res.status(400).json({ error: error.message });
      }
    }
  };
  performTransaction()
});

// Fetch transactions
router.get("/transactions", async (req, res) => {
  try {
    // const { walletId, skip, limit } = req.query;
    const { skip, limit, walletId, sortBy, sortOrder } = req.query;
    console.log("🚀 ~ file: wallet.js:92 ~ router.get ~ req.query:", req.query)
  
    const sort = {};
    if (sortBy === 'date') {
      sort.date = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'amount') {
      sort.amount = sortOrder === 'asc' ? 1 : -1;
    }
    const transactions = await Transaction.find({ walletId }).skip(parseInt(skip)).limit(parseInt(limit)).sort(sort);
    // Get the total count of transactions
    const totalCount = await Transaction.countDocuments({ walletId });

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({transactions,totalCount,totalPages});
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get wallet details
router.get("/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      throw new Error("Invalid wallet id");
    }
    const wallet = await Wallet.findById(req.params.id);

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.status(200).json(wallet);
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    // res.status(500).json({ error: 'Internal server error' });
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
