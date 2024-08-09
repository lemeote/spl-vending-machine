import * as anchor from "@coral-xyz/anchor";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  Keypair,
  Signer,
  Connection,
} from "@solana/web3.js";

export const airdrop = async (wallet: PublicKey, connection: Connection) => {
  let tx = await connection.requestAirdrop(
    wallet,
    2 * anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx, "confirmed");
};

export const getAtaForMint = async (
  tokenRecipient: PublicKey,
  mintKey: PublicKey,
  tokenProgramID: PublicKey = TOKEN_PROGRAM_ID,
  associatedProgramID: PublicKey = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [tokenRecipient.toBuffer(), tokenProgramID.toBuffer(), mintKey.toBuffer()],
    associatedProgramID
  );
};

// mint NFT for testing purpose
export const mintToken = async (
  provider: anchor.Provider,
  payer: Keypair,
  mintAuthority: Keypair,
  freezeAuthority: Keypair,
  amount: number
) => {
  // random mint key for testing purpose
  const tokenMintKeypair = anchor.web3.Keypair.generate();

  const lamportsForMint =
    await provider.connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );

  const createMintAccountInstruction = anchor.web3.SystemProgram.createAccount({
    programId: TOKEN_PROGRAM_ID,
    space: MintLayout.span,
    fromPubkey: payer.publicKey,
    newAccountPubkey: tokenMintKeypair.publicKey,
    lamports: lamportsForMint,
  });

  const mintInstruction = createInitializeMintInstruction(
    tokenMintKeypair.publicKey,
    0,
    mintAuthority.publicKey,
    freezeAuthority.publicKey
  );

  const [payerAta, _] = await getAtaForMint(
    payer.publicKey,
    tokenMintKeypair.publicKey
  );

  const stakerAtaInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    payerAta,
    payer.publicKey,
    tokenMintKeypair.publicKey
  );

  const mintToInstruction = createMintToInstruction(
    tokenMintKeypair.publicKey,
    payerAta,
    payer.publicKey,
    amount,
    []
  );

  const txWithSigners: {
    tx: Transaction;
    signers?: Signer[];
  }[] = [];

  const transaction1 = new Transaction();
  transaction1.add(createMintAccountInstruction);
  transaction1.add(mintInstruction);
  transaction1.add(stakerAtaInstruction);
  transaction1.add(mintToInstruction);

  txWithSigners.push({
    tx: transaction1,
    signers: [payer, tokenMintKeypair], // first has to be payer because this account is used for deduction payment in any transaction
  });

  await provider.sendAll!(txWithSigners);

  return {
    payerAta: payerAta,
    tokenMint: tokenMintKeypair.publicKey,
  };
};

export const getRawTokenAccount = async (
  provider: anchor.Provider,
  address: PublicKey
) => {
  const account = await provider.connection.getAccountInfo(address);
  if (account == null) {
    return null;
  }
  return AccountLayout.decode(account.data);
};

export const getVendingMachinePda = async (
  manager: PublicKey,
  programId: PublicKey
) => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("vending-machine"), manager.toBuffer()],
    programId
  );
};
