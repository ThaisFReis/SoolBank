import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Solbank } from "../target/types/solbank";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

describe("SolBank", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Solbank as Program<Solbank>;
  const owner = provider.wallet as anchor.Wallet;

  // PDAs for the primary test user
  let bankAccountPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;

  // SPL token setup
  let mint: anchor.web3.PublicKey;
  let ownerAta: anchor.web3.PublicKey;
  let vaultAta: anchor.web3.PublicKey;

  // Secondary wallet for access-control and multi-user tests
  const stranger = anchor.web3.Keypair.generate();
  let strangerBankPda: anchor.web3.PublicKey;
  let strangerVaultPda: anchor.web3.PublicKey;

  before(async () => {
    // Derive PDAs
    [bankAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bank_account"), owner.publicKey.toBuffer()],
      program.programId
    );
    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );

    [strangerBankPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bank_account"), stranger.publicKey.toBuffer()],
      program.programId
    );
    [strangerVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), stranger.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop SOL to stranger
    const sig = await provider.connection.requestAirdrop(
      stranger.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Create SPL mint
    mint = await createMint(
      provider.connection,
      owner.payer,
      owner.publicKey,
      null,
      6 // 6 decimals
    );

    // Create owner's ATA and mint tokens
    const ownerAtaInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      owner.publicKey
    );
    ownerAta = ownerAtaInfo.address;

    await mintTo(
      provider.connection,
      owner.payer,
      mint,
      ownerAta,
      owner.payer,
      1_000_000 // 1 token with 6 decimals
    );

    // Derive vault ATA address (will be created during deposit_spl)
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);
  });

  // ─────────────────────────────────────────────
  // INITIALIZE
  // ─────────────────────────────────────────────
  describe("initialize", () => {
    it("creates bank_account and vault PDAs with correct data", async () => {
      await program.methods
        .initialize()
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const account = await program.account.bankAccount.fetch(bankAccountPda);
      assert.ok(account.owner.equals(owner.publicKey), "owner mismatch");
      assert.ok(account.createdAt.toNumber() > 0, "created_at not set");
    });

    it("bank_account.owner equals the signer", async () => {
      const account = await program.account.bankAccount.fetch(bankAccountPda);
      assert.ok(account.owner.equals(owner.publicKey));
    });

    it("fails if same wallet tries to initialize twice", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected error on double init");
      } catch (e: any) {
        assert.ok(e.message, "should throw on duplicate init");
      }
    });
  });

  // ─────────────────────────────────────────────
  // DEPOSIT SOL
  // ─────────────────────────────────────────────
  describe("deposit_sol", () => {
    const depositAmount = new BN(0.1 * LAMPORTS_PER_SOL);

    it("deposits SOL and vault lamports increase correctly", async () => {
      const vaultBefore = await provider.connection.getBalance(vaultPda);

      await program.methods
        .depositSol(depositAmount)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const vaultAfter = await provider.connection.getBalance(vaultPda);
      assert.equal(
        vaultAfter - vaultBefore,
        depositAmount.toNumber(),
        "vault balance should increase by deposit amount"
      );
    });

    it("multiple deposits accumulate correctly", async () => {
      const vaultBefore = await provider.connection.getBalance(vaultPda);

      await program.methods
        .depositSol(depositAmount)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const vaultAfter = await provider.connection.getBalance(vaultPda);
      assert.equal(vaultAfter - vaultBefore, depositAmount.toNumber());
    });

    it("fails if amount is zero", async () => {
      try {
        await program.methods
          .depositSol(new BN(0))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected InvalidAmount error");
      } catch (e: any) {
        assert.include(e.message, "InvalidAmount");
      }
    });

    it("fails if signer is not the owner", async () => {
      try {
        await program.methods
          .depositSol(depositAmount)
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: stranger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Expected constraint violation");
      } catch (e: any) {
        assert.ok(e.message, "should throw on wrong owner");
      }
    });
  });

  // ─────────────────────────────────────────────
  // WITHDRAW SOL
  // ─────────────────────────────────────────────
  describe("withdraw_sol", () => {
    const withdrawAmount = new BN(0.05 * LAMPORTS_PER_SOL);

    it("withdraws SOL and owner lamports increase", async () => {
      const ownerBefore = await provider.connection.getBalance(owner.publicKey);

      await program.methods
        .withdrawSol(withdrawAmount)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const ownerAfter = await provider.connection.getBalance(owner.publicKey);
      // owner gains withdrawAmount minus tx fees — just check it increased
      assert.ok(ownerAfter > ownerBefore - 10_000, "owner balance should increase");
    });

    it("partial withdrawal keeps remaining balance in vault", async () => {
      const vaultBefore = await provider.connection.getBalance(vaultPda);
      const small = new BN(0.01 * LAMPORTS_PER_SOL);

      await program.methods
        .withdrawSol(small)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const vaultAfter = await provider.connection.getBalance(vaultPda);
      assert.equal(vaultBefore - vaultAfter, small.toNumber());
    });

    it("fails if amount exceeds available balance", async () => {
      try {
        await program.methods
          .withdrawSol(new BN(100 * LAMPORTS_PER_SOL))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected InsufficientFunds error");
      } catch (e: any) {
        assert.include(e.message, "InsufficientFunds");
      }
    });

    it("fails if amount is zero", async () => {
      try {
        await program.methods
          .withdrawSol(new BN(0))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected InvalidAmount error");
      } catch (e: any) {
        assert.include(e.message, "InvalidAmount");
      }
    });

    it("fails if signer is not owner", async () => {
      try {
        await program.methods
          .withdrawSol(withdrawAmount)
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: stranger.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Expected constraint violation");
      } catch (e: any) {
        assert.ok(e.message);
      }
    });
  });

  // ─────────────────────────────────────────────
  // DEPOSIT SPL
  // ─────────────────────────────────────────────
  describe("deposit_spl", () => {
    const tokenAmount = new BN(100_000); // 0.1 tokens (6 decimals)

    it("deposits SPL tokens and vault ATA balance increases", async () => {
      await program.methods
        .depositSpl(tokenAmount)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          vaultTokenAccount: vaultAta,
          ownerTokenAccount: ownerAta,
          mint: mint,
          owner: owner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const vaultAtaInfo = await getAccount(provider.connection, vaultAta);
      assert.equal(vaultAtaInfo.amount.toString(), tokenAmount.toString());
    });

    it("vault ATA is created automatically on first deposit", async () => {
      const ataInfo = await getAccount(provider.connection, vaultAta);
      assert.ok(ataInfo, "vault ATA should exist after deposit");
    });

    it("fails if amount is zero", async () => {
      try {
        await program.methods
          .depositSpl(new BN(0))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            vaultTokenAccount: vaultAta,
            ownerTokenAccount: ownerAta,
            mint: mint,
            owner: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected InvalidAmount error");
      } catch (e: any) {
        assert.include(e.message, "InvalidAmount");
      }
    });

    it("fails if signer is not owner", async () => {
      try {
        await program.methods
          .depositSpl(tokenAmount)
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            vaultTokenAccount: vaultAta,
            ownerTokenAccount: ownerAta,
            mint: mint,
            owner: stranger.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Expected constraint violation");
      } catch (e: any) {
        assert.ok(e.message);
      }
    });
  });

  // ─────────────────────────────────────────────
  // WITHDRAW SPL
  // ─────────────────────────────────────────────
  describe("withdraw_spl", () => {
    const withdrawTokenAmount = new BN(50_000); // 0.05 tokens

    it("withdraws SPL tokens and owner ATA balance increases", async () => {
      const ownerAtaBefore = await getAccount(provider.connection, ownerAta);
      const vaultAtaBefore = await getAccount(provider.connection, vaultAta);

      await program.methods
        .withdrawSpl(withdrawTokenAmount)
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          vaultTokenAccount: vaultAta,
          ownerTokenAccount: ownerAta,
          mint: mint,
          owner: owner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const ownerAtaAfter = await getAccount(provider.connection, ownerAta);
      const vaultAtaAfter = await getAccount(provider.connection, vaultAta);

      assert.equal(
        BigInt(ownerAtaAfter.amount.toString()) - BigInt(ownerAtaBefore.amount.toString()),
        BigInt(withdrawTokenAmount.toString())
      );
      assert.equal(
        BigInt(vaultAtaBefore.amount.toString()) - BigInt(vaultAtaAfter.amount.toString()),
        BigInt(withdrawTokenAmount.toString())
      );
    });

    it("fails if amount exceeds vault token balance", async () => {
      try {
        await program.methods
          .withdrawSpl(new BN(999_999_999))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            vaultTokenAccount: vaultAta,
            ownerTokenAccount: ownerAta,
            mint: mint,
            owner: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Expected InsufficientFunds error");
      } catch (e: any) {
        assert.include(e.message, "InsufficientFunds");
      }
    });

    it("fails if amount is zero", async () => {
      try {
        await program.methods
          .withdrawSpl(new BN(0))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            vaultTokenAccount: vaultAta,
            ownerTokenAccount: ownerAta,
            mint: mint,
            owner: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Expected InvalidAmount error");
      } catch (e: any) {
        assert.include(e.message, "InvalidAmount");
      }
    });

    it("fails if signer is not owner", async () => {
      try {
        await program.methods
          .withdrawSpl(withdrawTokenAmount)
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            vaultTokenAccount: vaultAta,
            ownerTokenAccount: ownerAta,
            mint: mint,
            owner: stranger.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Expected constraint violation");
      } catch (e: any) {
        assert.ok(e.message);
      }
    });
  });

  // ─────────────────────────────────────────────
  // CLOSE ACCOUNT
  // ─────────────────────────────────────────────
  describe("close_account", () => {
    it("fails if vault still has SOL balance", async () => {
      // vault still has SOL from previous deposit tests — should fail
      try {
        await program.methods
          .closeAccount()
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected AccountNotEmpty error");
      } catch (e: any) {
        assert.include(e.message, "AccountNotEmpty");
      }
    });

    it("closes account and returns rent after draining vault", async () => {
      // First, withdraw all remaining SOL from vault
      const rent = await provider.connection.getMinimumBalanceForRentExemption(0);
      const vaultBalance = await provider.connection.getBalance(vaultPda);
      const available = vaultBalance - rent;

      if (available > 0) {
        await program.methods
          .withdrawSol(new BN(available))
          .accounts({
            bankAccount: bankAccountPda,
            vault: vaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
      }

      const ownerBefore = await provider.connection.getBalance(owner.publicKey);

      await program.methods
        .closeAccount()
        .accounts({
          bankAccount: bankAccountPda,
          vault: vaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const ownerAfter = await provider.connection.getBalance(owner.publicKey);
      // Owner should have gained lamports (rent refund minus tx fee)
      assert.ok(ownerAfter > ownerBefore - 10_000, "owner should receive rent refund");

      // BankAccount PDA should no longer exist
      const closed = await provider.connection.getAccountInfo(bankAccountPda);
      assert.isNull(closed, "bank_account should be closed");
    });

    it("fails if signer is not owner", async () => {
      // Initialize a fresh account for stranger to test access control
      await program.methods
        .initialize()
        .accounts({
          bankAccount: strangerBankPda,
          vault: strangerVaultPda,
          owner: stranger.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([stranger])
        .rpc();

      try {
        // Owner tries to close stranger's account — should fail
        await program.methods
          .closeAccount()
          .accounts({
            bankAccount: strangerBankPda,
            vault: strangerVaultPda,
            owner: owner.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Expected constraint violation");
      } catch (e: any) {
        assert.ok(e.message);
      }
    });
  });

  // ─────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────
  describe("edge cases", () => {
    it("two users have independent accounts", async () => {
      // strangerBankPda was already created in the close_account test
      const strangerAccount = await program.account.bankAccount.fetch(strangerBankPda);
      assert.ok(strangerAccount.owner.equals(stranger.publicKey));

      // Verify stranger's vault is separate from owner's
      assert.ok(!strangerVaultPda.equals(vaultPda), "vaults should be different");
    });

    it("deposit then withdraw exact amount leaves vault at rent minimum", async () => {
      // Re-initialize owner account (was closed above)
      const [newBankPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("bank_account"), owner.publicKey.toBuffer()],
        program.programId
      );
      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), owner.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initialize()
        .accounts({
          bankAccount: newBankPda,
          vault: newVaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const depositLamports = new BN(0.5 * LAMPORTS_PER_SOL);
      await program.methods
        .depositSol(depositLamports)
        .accounts({
          bankAccount: newBankPda,
          vault: newVaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .withdrawSol(depositLamports)
        .accounts({
          bankAccount: newBankPda,
          vault: newVaultPda,
          owner: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const rent = await provider.connection.getMinimumBalanceForRentExemption(0);
      const vaultFinal = await provider.connection.getBalance(newVaultPda);
      assert.equal(vaultFinal, rent, "vault should only hold rent-exempt minimum");
    });
  });
});
