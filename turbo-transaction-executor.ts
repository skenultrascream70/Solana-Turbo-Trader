import {
  BlockhashWithExpiryBlockHeight,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { TransactionExecutor } from './transaction-executor.interface';
import { logger } from '../helpers';
import axios, { AxiosError } from 'axios';
import bs58 from 'bs58';
import { Currency, CurrencyAmount } from '@raydium-io/raydium-sdk';

export class TurboTransactionExecutor implements TransactionExecutor {
  private readonly turboFeeWallet = new PublicKey('TURBOzUMPnycu9eeCZ95rcAUxorqpBqHndfV3ZP5FSyS');

  constructor(private readonly turboFee: string) {}

  public async executeAndConfirm(
    transaction: VersionedTransaction,
    payer: Keypair,
    latestBlockhash: BlockhashWithExpiryBlockHeight,
  ): Promise<{ confirmed: boolean; signature?: string; error?: string }> {
    logger.debug('Executing transaction...');

    try {
      const fee = new CurrencyAmount(Currency.SOL, this.turboFee, false).raw.toNumber();
      const turboFeeMessage = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: this.turboFeeWallet,
            lamports: fee,
          }),
        ],
      }).compileToV0Message();

      const turboFeeTx = new VersionedTransaction(turboFeeMessage);
      turboFeeTx.sign([payer]);

      const response = await axios.post<{ confirmed: boolean; signature: string; error?: string }>(
        'https://tx.turbo-trader.io/transaction/execute',
        {
          transactions: [bs58.encode(turboFeeTx.serialize()), bs58.encode(transaction.serialize())],
          latestBlockhash,
        },
        {
          timeout: 100000,
        },
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.trace({ error: error.response?.data }, 'Failed to execute turbo transaction');
      }
    }

    return { confirmed: false };
  }
}
