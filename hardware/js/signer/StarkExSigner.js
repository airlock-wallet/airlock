/**
 * Copyright (C) 2026 Le Wang
 *
 * This file is part of Airlock.
 *
 * Airlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Airlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Airlock.  If not, see <https://www.gnu.org/licenses/>.
 */

const TrustWalletCoreModule = require('@trustwallet/wallet-core');
const { TW } = require('@trustwallet/wallet-core');

/**
 * Universal signing result
 * @typedef {Object} SignerResult
 * @property {string} encoded   - [Required] Final signed data (Hex String)
 * @property {Object} [extend]  - [Optional] Extended data
 */
class StarkExSigner {
    constructor() {
        this.core = null;
    }

    async init() {
        this.core = await TrustWalletCoreModule.initWasm();
    }

    /**
     * Scenario 1: StarkEx Message Signing (testStarkExSignAndVerifyMessage)
     * Independent Logic: Use StarkEx specific signer, enforcing public/private key validation
     * @param {Object} txData
     * @param {string} txData.privateKey - [Required] Private key (Hex)
     * @param {string} txData.message    - [Required] Message hash to sign (Hex)
     * @returns {SignerResult}
     */
    signMessage(txData) {
        const { StarkExMessageSigner, PrivateKey, HexCoding } = this.core;

        // 1. Strictly clean and validate private key
        const cleanKey = txData.privateKey.startsWith('0x') ? txData.privateKey.slice(2) : txData.privateKey;
        const pkData = HexCoding.decode(cleanKey);

        const privateKey = PrivateKey.createWithData(pkData);
        if (!privateKey) {
            throw new Error("StarkExSigner: Invalid Private Key");
        }

        // 2. Validate message format
        const msg = txData.message.startsWith('0x') ? txData.message.slice(2) : txData.message;
        if (!msg) {
            throw new Error("StarkExSigner: Message is required");
        }

        // 3. Execute signing (StarkEx specific logic)
        // Note: StarkExMessageSigner.signMessage in Wasm directly accepts PrivateKey object and string
        const signature = StarkExMessageSigner.signMessage(privateKey, msg);

        // --- Output Verification ---
        if (!signature || signature.length === 0) {
            throw new Error("StarkExSigner: Signing produced empty signature");
        }

        return {
            encoded: signature,
            extend: {
                // Automatically derive public key for business layer verification
                publicKey: HexCoding.encode(privateKey.getPublicKeyByType(this.core.PublicKeyType.starkex).data())
            }
        };
    }

    /**
     * Scenario 2: StarkEx Message Verification (Verify)
     * @param {string} publicKey - Public key (Hex)
     * @param {string} message    - Original message hash (Hex)
     * @param {string} signature - Signature (Hex)
     * @returns {boolean}
     */
    verifyMessage(publicKey, message, signature) {
        const { StarkExMessageSigner, PublicKey, HexCoding, PublicKeyType } = this.core;

        const cleanPub = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
        const pubKey = PublicKey.createWithData(HexCoding.decode(cleanPub), PublicKeyType.starkex);

        const cleanMsg = message.startsWith('0x') ? message.slice(2) : message;

        return StarkExMessageSigner.verifyMessage(pubKey, cleanMsg, signature);
    }
}

module.exports = StarkExSigner;