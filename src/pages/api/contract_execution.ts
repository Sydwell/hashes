/**
 *  The code to execute the function 
 */
import { Contract, ElectrumNetworkProvider, SignatureTemplate, Utxo } from 'cashscript'
import { binToHex, hexToBin, deriveHdPrivateNodeFromSeed, deriveHdPath, secp256k1, encodeCashAddress, swapEndianness } from '@bitauth/libauth'
import artifact from './h4c-beta-v3.json'  assert { type: "json" }
import { OpReturnData, SendRequest, Wallet } from 'mainnet-js'
import { hash160, encodeString, sha256 } from '@cashscript/utils'




const masterPub = "021b0773eb7ceeaad890ec8c384071338bffda9d392c671cc41128587ff8b04867"
const paymentCategory = "cc738a86975b1d0f6dad394f64cdb0e38d35d852e5ef3e193a071e2ff0e1915d"

const cashonizeAddress = 'bitcoincash:zra9c3l9k03ze9l9u985u76y30tq0n9fmv4pdss438'
export const payTokenAddress = 'bitcoincash:zpq8xc3km6q692l92v2jmx0zgunk3wz6asp2zllsj0'
export const minBCHtoPlay = 0.0002;
const rewardCategory = "15b0b8039f35462dd4cc7f7fa9a29e9813288c654dbf636f6b15e104479bab52"
const sydCoin = "c18076a677350393ba16baefed662fafbf99371d4de111123f30ea517044a1a6"
const controlCategory = "7a7f40435dbc482ce64455de184f224efdbcf77f796d61dc59e2e827970ef2af"
const provider = new ElectrumNetworkProvider('mainnet')
const options = { provider, addressType: 'p2sh32' as any }


/**
 * Constructs the to op_return data and the fullSignature of the guess and game index.
 * The game index is derived from control token in the contract UTXO.
 * 
 * The Op-Return consists 4 pieces of data:
 * 1) A self generated, app identifying Op-Return identifier 0x42513031. 
 * 2) The game index in hex LE.
 * 3) The players signature of the of the combined Guess in hex LE and Game index in hex LE. 
 * 4) A player identifier consisting of the first 10 and last 10 characters of the players wallet address
 *    
 * @param guessHex 
 * @param playerPrivBytes 
 */
export async function opReturnConstruction(numberGuessed: number, playerPrivBytes: Uint8Array): Promise<[OpReturnData, string]> {
    const contract = new Contract(artifact, [masterPub, 10000n], options)
    const utXos = await contract.getUtxos()
    const numberGuessedInHex = numberGuessed.toString(16).padStart(8, '0')
    const guessHexLE = swapEndianness(numberGuessedInHex)

    let playerPub = secp256k1.derivePublicKeyCompressed(playerPrivBytes) as Uint8Array;
    const playerPkh = hash160(playerPub);
    const playerTokenAddress = encodeCashAddress('bitcoincash', 'p2pkhWithTokens', playerPkh)
    const ident = playerTokenAddress.replace("bitcoincash:", "")
    const playerIdentifier = binToHex(encodeString(ident.substring(0, 10) + ident.substring(ident.length - 10)))

    let controlUtxo = utXos.find(pU => pU.token?.category == controlCategory)
    if (controlUtxo != undefined) {
        let gameIndexHex = controlUtxo?.token?.nft?.commitment.substr(0, 8) as string
        
        let hashed = sha256(hexToBin(guessHexLE + gameIndexHex))
        let fullSig = secp256k1.signMessageHashSchnorr(playerPrivBytes, hashed) as Uint8Array;
        let partSig = binToHex(fullSig).substring(0, 8)
        let hashedHex = binToHex(hashed)
        let guessValueInSats = minBCHtoPlay * 100_000_000
        console.log(`to sha256 ${guessHexLE + gameIndexHex} partSig ${partSig} hashedHex ${hashedHex}`)
        // let sr: SendRequest = { cashaddr: payTokenAddress, value: guessValueInSats, unit: 'sats' }
        let sr: SendRequest = { cashaddr: contract.tokenAddress, value: guessValueInSats, unit: 'sats' }
        let ord = { buffer: Buffer.from('42513031' + gameIndexHex + partSig + playerIdentifier, 'hex') }
       // console.log(`tsr tsr sr ${sr} ${ord}`)
        return [ord, binToHex(fullSig)]
    } else {
        throw "Unable construct the Op-Return data."
    }
}

/**
 * Queries the contract to get the current round number as an integer.
 * Note The round number is stored in 4 bytes in LE format in the commitment filed of the `Control Token`. 
 *    
 * @param guessHex 
 * @param privateKey 
 */
export async function getCurrentRound(): Promise<number> {
    const contract = new Contract(artifact, [masterPub, 10000n], options)
    const utXos = await contract.getUtxos()
    let controlUtxo = utXos.find(pU => pU.token?.category == controlCategory)
    if (controlUtxo != undefined) {
        let gameIndexHex = controlUtxo?.token?.nft?.commitment.substr(0, 8) as string
        let gameIndex = parseInt(swapEndianness(gameIndexHex), 16)
        console.log(`Contract Address ${contract.tokenAddress} current Round ${gameIndex} `)
        return gameIndex
    } else {
        throw "Unable get op_return data"
    }
}

/**
 *  
 * @returns 
 */
export function getContractAddress(): string {
    const contract = new Contract(artifact, [masterPub, 10000n], options)
    return contract.tokenAddress
}

/**
 * We provide the ability to increase the winning amounts to the player.
 * This is based on the number of previously losing bets.
 * 
 * The winning amount is simply the inputs if there is more than 5 inputs,
 * else default is 4.
 * 
 * The 5 inputs would be 1 control input + 1 contractCurrentValueUtxo + 1 winning + 2 losing guess inputs.
 * @returns 
 */
export async function currentWinAmountInSats(): Promise<number> {
    const contract = new Contract(artifact, [masterPub, 10000n], options)
    const contractUtxos = await contract.getUtxos()
    let reps2win // default win amount is amount of inputs, simple for more than 5 inputs.
    // For less than
    if (contractUtxos.length < 6) {
        reps2win = 4
    } else {
        reps2win = contractUtxos.length
    }
    return reps2win * 10_000
}


/**
 * Calculates the recoverable sats
 * @TODO accumulate waits in a promiseAll
 * 
 * @param contract 
 * @param sat2win 
 * @returns 
*/
async function calcRecover(contract: Contract, sat2win: number, collect: boolean): Promise<bigint> {
    
    let outputSizes = 6 + 193 // The Tx headers plus our 3 outputs
    // let sizes = 230 // Possible signatures 
    let typicalInput: number
    if (collect) {
        typicalInput = 1000
    } else {
        typicalInput = 1500
    } 
    let noOfUtxos = (await contract.getUtxos()).length
    let contractBalance = await contract.getBalance()
    
    console.log("calcRecover typical Input", typicalInput, 'sat2win', sat2win)
    let typicalTxSats = Math.floor(((typicalInput * noOfUtxos) + outputSizes) ) 
    let sats2Recover = contractBalance - (BigInt(typicalTxSats + sat2win) )
    return sats2Recover 
}

/**
 * Get the payment utxo so that the contract can validate it's consistency. 
 * 
 * @param paymentTxId 
 * @returns 
*/
async function getControlUtxo(contractUtxos: Utxo[]): Promise<Utxo> {
    let controlUtxo = contractUtxos.find(pU => pU.token?.category == controlCategory)
    return controlUtxo as Utxo
}

/**
 * Get the payment utxo so that the contract can validate it's consistency.
 * No need to consider the op-return output here as the contract with the partSig will do the job!  
 * 
 * @param paymentTxId 
 * @returns 
 */
async function getPaymentUtxo(paymentTxId: string, contractAddress: string): Promise<Utxo | null> {
    const decodedTx = await Wallet.util.decodeTransaction(paymentTxId, true);
    for await (let vo of decodedTx.vout) {
        if (vo.scriptPubKey.addresses[0] == contractAddress) {
            console.log('find', vo.scriptPubKey.hex, vo.n, vo.scriptPubKey, vo.tokenData, vo.value)
            return { satoshis: BigInt(vo.value * 100_000_000), vout: vo.n, token: vo.tokenData, txid: paymentTxId } as Utxo
        } else {
            console.log('wrong', vo.scriptPubKey.hex, vo.scriptPubKey.hex.length, vo)
        }
    }
    return null
}

/**
 * The player attempt to collect the win amount allocated in this contract.
 * In addition to choosing the correct number, numerous other conditions need to be satisfied in order for this to succeed. See the comments in the contract it self.
 *  
 * @param numberGuessed 
 * @param playerPrivBytes 
 * @param fullSig 
 * @param paymentTxId 
 * @returns 
 */
export async function contractExecution(numberGuessed: number, playerPrivBytes: Uint8Array, fullSig: string, paymentTxId: string): Promise<boolean> {
    type capability_type = "none" | "mutable" | "minting";
    const contract = new Contract(artifact, [masterPub, 10000n], options)
    const playerPub = secp256k1.derivePublicKeyCompressed(playerPrivBytes) as Uint8Array;
    const playerSig = new SignatureTemplate(playerPrivBytes);
    const partSig = fullSig.substring(0, 8)
    const raw = await provider.getRawTransaction(paymentTxId)// 0x42513031  as suppose to partSig of 0bad6e68 @ opIndex 351 343 
    const playerPkh = hash160(playerPub);
    const playerTokenAddress = encodeCashAddress('bitcoincash', 'p2pkhWithTokens', playerPkh)

    /* These vars are all needed to execute our contract */
    let controlSayGameIndexIs: string
    let controlToken
    let rewardToken
    let playerIdentifier = '' // 'C011EC'
    let paymentUtxo
    const contractUtxos = await contract.getUtxos()
    //let controlUtxo = contractUtxos.find(pU => pU.token?.category == controlCategory)
    let rewardUtxo = contractUtxos.find(pU => pU.token?.category == rewardCategory)
    const controlUtxo = await getControlUtxo(contractUtxos)
    /** CONTROL */
    if (controlUtxo != null) {
        console.log(`controlUtxo `)
        console.log(controlUtxo)
        controlSayGameIndexIs = controlUtxo.token?.nft?.commitment.substr(0, 8) as string // 1st Four bytes LE for the game number 2nd 4-bytes is the seed
        // gameIndex = parseInt(swapEndianness(gameIndexStr), 16); //  The true game index

        console.log(`controlToken will process UTXO' with this ${controlSayGameIndexIs} game index and a partSig of ${partSig}.`)
        console.log(controlToken)
    } else {
        console.log(`No controlUtxo `)
        return false
    }
    //if (playerIdentifier != 'C011EC') {

    let opIndex = (raw.indexOf('42513031' + controlSayGameIndexIs + partSig) / 2)
    if (opIndex < 20) { // Sanity check 
        throw `Expected op-return partSig ${partSig} not found in txt`
    }
    // Why does this not work? > let playerIdentifier = raw.substring((opIndex*2) + 24, 40 );
    playerIdentifier = raw.substring((opIndex * 2) + 24);
    playerIdentifier = playerIdentifier.substring(0, 40)
    console.log(`Player ${binToHex(playerPkh)}  ${playerTokenAddress} playerIdentifier ${playerIdentifier} raw len ${raw.length} ${playerIdentifier.length} opIndex ${opIndex} len ${('42513031' + controlSayGameIndexIs + partSig).length} `)
    paymentUtxo = await getPaymentUtxo(paymentTxId, contract.address) as Utxo
   // } 

    let hexNumber = numberGuessed.toString(16).padStart(8, '0')
    let hexNumberS = swapEndianness(hexNumber)
    let gameIndex = parseInt(swapEndianness(controlSayGameIndexIs), 16)
    /** Because we potentially have the correct payment token we need to mutate the control token as required */
    let newGameIndex = gameIndex + 1
    //let newGameIndex = 16843009 // When testing keeping game index the same
    let gameIndex_hex = swapEndianness(newGameIndex.toString(16).padStart(8, '0'))
    // winningAmount = BigInt(parseInt(swapEndianness(potentialPlayerCommitment.substr(24, 8)), 16) * 10000)

    console.log(`gameIndex ${gameIndex} ${newGameIndex} newGameIndex in hex ${gameIndex_hex} playerIdentifier ${playerIdentifier}`)
    let newCommitment = gameIndex_hex + partSig + hexNumberS + playerIdentifier
    console.log(`new commitment ${newCommitment} length ${newCommitment.length} `)
    controlToken = {
        amount: 0n,
        category: controlCategory,
        nft: {
            capability: 'mutable' as capability_type,
            commitment: newCommitment
        }
    }
    /**  Payments can be null if collecting */
    if (playerIdentifier == 'C011EC' && paymentUtxo == null) {
        console.log(`collect only `)
    }

    /**  
     * This is the utxo we use to collect value, Need to make sure balance doesn't fall below this value! 
     * 1) This is the primary means we identify this UTXO.
     * 2) The contract checks if the at least this amount is returned. 
     **/
    let contractCurrentValueUtxo = contractUtxos.find(pU => pU.satoshis > 30000n) as Utxo
    let txDetails


    /**
     * Construct the array of funding/losing transactions
     * The controlUtxo needs to be first
     * 
     * The contractCurrentValueUtxo needs to be third as we that input value to check if the refund transaction is sensible.
     */
    
    let fundingUtxos = []
    for (let pU of contractUtxos) {
        if (pU.txid == controlUtxo.txid) continue; // skip as to be fixed first utxo.
        if (paymentUtxo != null && pU.txid == paymentUtxo.txid) continue; // skip as to be fixed second utxo.
        if (pU.txid == contractCurrentValueUtxo.txid) continue; // skip as to be fixed third utxo.
        if (pU.satoshis > 5000n) {
            // txtSize += pU. 
            fundingUtxos.push(pU)
        }
    }

    const sat2win = await currentWinAmountInSats()
   
    /** 
     * Does it work? Yes
     */
    try {
        let recoveredSats = await calcRecover(contract, sat2win, false)
        console.log('fullSig', fullSig, "recoveredSats", recoveredSats, controlUtxo.token?.nft?.commitment, `controlToken`, controlToken.nft.commitment)
        txDetails = await contract.functions
            .checkWin(playerPub, playerSig, hexToBin(fullSig), raw, BigInt(opIndex))
            .from(controlUtxo)
            .from(paymentUtxo)
            .from(contractCurrentValueUtxo)
            .from(fundingUtxos)
            .to(contract.tokenAddress, 1000n, controlToken)
            .to(playerTokenAddress, BigInt(sat2win)) 
            .to(contract.tokenAddress, recoveredSats) // 
            .withoutChange()
           // .meep()
            .send()
        console.log(`txDetails `, txDetails);
    } catch (txError) {
        console.log(`Probs wrong guess `, txError);

    }
    // */

    if (typeof txDetails == "object") {
        // @ts-ignore
        console.log('txDetails id', txDetails.txid);
        return true
    }
    return false
}

