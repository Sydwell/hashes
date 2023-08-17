
export interface Props {
    onCloseThisContract: () => void;
}

function ThisContract({ onCloseThisContract: onThisContractClose }: Props) {
    const obj = `
pragma cashscript ^0.8.0;

/** Site Wide Global Data
// Contract Address: bitcoincash:rv2kndd6gkz4wkjxgn4p8xxxjt9vzq6gkzae79vc9lvpguv6m7gpums6y7c8y
// Command Line compile statement: cashc -o h4c-beta-v3.json h4c-beta-v3.cash
// MasterPubkey: 021b0773eb7ceeaad890ec8c384071338bffda9d392c671cc41128587ff8b04867
// satsPerRep: 10000n = 0.0001BCH // This is site wide value of 1 representable Units in sats

// controlCategory: 7a7f40435dbc482ce64455de184f224efdbcf77f796d61dc59e2e827970ef2af;
// controlCategory_rev: aff20e9727e8e259dc616d797ff7bcfd4e224f18de5544e62c48bc5d43407f7a

/**
 * A general description of protocol utxo/token data:
 * 
{Utxo input 0}
    <control token utxo> = <round><winHash><winning number> and  <winning identifier>
{Utxo input 1}
    <payment utxo> = <amount paid>
    <payment opReturn> = <opReturn bquest id><round in Bytes><partialSig of 'hash'>
    where 'hash' is the sha256 of guess number and round number 
{Utxo input 2}  
    main contractCurrentValue utxo 
{input 3...} 
    all other losing utxo inputs}

where   winHash input is used to calculate winner!
        winHash output is set to partial part of the signedData!
        winning number in is not used
        winning number out is same as user supplied guess
        winning identifiers are never checked, implement give GUI developers an easier way to display winners

 * Output 0: controlToken UTXO
 * Output 1 winnings to user
 * Output 2: change output
     

**/

contract H4C_beta_v3(pubkey master, int satsPerRep) { 

    

    function checkWin(pubkey playerPub, sig playerSig, datasig playerDataSig, bytes fullTxIn, int opIndex)  {
        /**********                     START checkB1                                      *****************/
        /* Do we have the correct control category? */
        bytes32 ControlCategory_rev  = 0xaff20e9727e8e259dc616d797ff7bcfd4e224f18de5544e62c48bc5d43407f7a;
        bytes ControlCategory_sp = tx.inputs[0].tokenCategory.split(32)[0];
        require(ControlCategory_rev == ControlCategory_sp);
        
        /** Is control UTXO sent back to the contract? */
        require(tx.inputs[0].lockingBytecode == tx.outputs[0].lockingBytecode);

        /** Is the correct payment sent to the contract?  */
        require(tx.inputs[1].value == satsPerRep * 2);

        /**
         * Is the supplied fullTxIn is correct?
         */
        require( tx.inputs[1].outpointTransactionHash == sha256(sha256(fullTxIn)) ); 

        /**
         * The winning amount is based on number of losing bets was placed.
         * All Losing bets and the contract utxo are sweep as inputs to this contract.
         * Any inputs above 5 attracts an additional 1 * satsPerRep
         */
        int reps2win = tx.inputs.length ; // default win amount is  amount of inputs, simple
        //  Player wins guaranteed 4 units up until 5 inputs (1 control input + 1 contract utxo input + 3 losing guess inputs)
        if (tx.inputs.length < 6) {  
            reps2win = 4;     
        }
        require(tx.outputs[1].value == reps2win * 10000 ); 
        
        /** 
         * Is the third output (the change) sent back to the contract!
         */
        require(tx.outputs[2].lockingBytecode == tx.inputs[0].lockingBytecode);

        /**
         * Check if we have a non trivial amount of sats coming back to the contract.
         */
        require(tx.outputs[2].value > 51000);
        

        /**
         * There will only ever be exactly 3 outputs.
         */
        require(tx.outputs.length == 3);


        /**********                     END checkB1                                      *****************/
        /**********                     START checkB2                                      *****************/
        /**
         * Find the op-return data the payment transaction
         */
        bytes split1 = fullTxIn.split(opIndex)[1];
        bytes txSays = split1.split(12)[0]; 
          
        /** 
         * Get the necessary variables from controlToken commitments.
         */
        bytes controlInData = tx.inputs[0].nftCommitment;
        bytes roundInBytes, bytes controlInOther1 = controlInData.split(4);
        bytes winHashIn = controlInOther1.split(4)[0]; 
        
        bytes controlOutData = tx.outputs[0].nftCommitment;
        bytes realRoundOut, bytes outCheck1 = controlOutData.split(4); 
        bytes winHashOut, bytes outCheck2 = outCheck1.split(4);
        bytes winningNumberInBytes = outCheck2.split(4)[0]; // The 2nd index is ident, which is not used

        /**
         * First 4 bytes of data signature, used for new hash and check that the same signature supply as 
         * when payment was made! 
         */
        bytes partSigBytes = bytes(playerDataSig).split(4)[0];

        /**
         * Is new hash correctly set?
         */
        require(winHashOut == partSigBytes);

         
        bytes opReturnData = 
             0x42513031 // BQ01, Our unique identifier as per op-return spec.
            + roundInBytes // The round for which the payment has made for.
            + partSigBytes // partSig of guess.
        ;
        require(opReturnData == txSays); 

        /**
         * Is the round incremented correctly? 
         */
        int roundInInt = int(roundInBytes) + 1;
        bytes4 roundOutBytes = bytes4(roundInInt);
        require(realRoundOut == roundOutBytes);

        /**
         * Is the signed data correctly?
         */
        bytes signedData =  winningNumberInBytes + roundInBytes ;
        require(checkDataSig(playerDataSig, signedData, playerPub));

        /**********                     END checkB2                                      ******************/
        /**********                     START checkB3                                     *****************/

        /**
         * Calculates the correct winning number!
         */
        bytes calcHash = <SECRET SAUCE>;
        calcHash = calcHash.split(2)[0];
        // The ending zeros to ensure we have a positive number 
        int theCorrectGuess = int ( calcHash + 0x00 );
        theCorrectGuess = (theCorrectGuess % 3)+1;

        /**
         * Has the player supplied the winning number? 
         */
        require(int(winningNumberInBytes) == theCorrectGuess);

        /**
         * Has the correct private key been supplied? 
         */ 
        require(checkSig(playerSig, playerPub));
        /**********                     END checkB3                                      ******************/
    }

    /** 
    * Ensure we can retrieve funds and control token.
    */
    function collection(sig masterSig) {
       require(checkSig(masterSig, master));
   }
}


    
    `;
    return (
        <>
            <h2>Contract Details</h2>

            <h3>A Cash Token to Maintain State</h3>
            <p>We use a mutable non fungible token to maintain contract state. The commitment field of NFT Labeled `Control Token` in the code is used maintain these states.  </p>
            <ul>
                <li>Current Round</li>
                <li>Winning Hash</li>
                <li>Last winning guess</li>
                <li>Last winning identity</li>
            </ul>
            <p>Amongst other encumbrances, the contract ensures the current round is incremented correctly and the next winningHash is based on the current winning signature.</p>
            <p>The `last winning guess` is how the current attempt is communicated to contract, if successful this is becomes the next `last winning guess`.
                The `Last winning identity` is provided to ease the maintenance of historical data.</p>
            
            <h3>The Payment and Op-Return Transaction</h3>
            <p>A valid user guess consists of the correct payment UTXO and an Op-Return containing the round number and the players signature of the combined the guess and round numbers.
                The third piece of data, is that of the player identity.
                <ul>
                    <li>Round number</li>
                    <li>Player signed Guess and Round number</li>
                    <li>Player Identity</li>
                </ul>
                This payment transaction consists of the payment UTXO as well as the unspendable OP-Return UTXO.
                </p>
            <h3>Winning Contract Claim?</h3>
            <p>    
                Once the payment transaction is completed, this site on behalf of player attempts to make a claim on the contract. If successful, the players payment amount in BCH is doubled or more. The winnings amount is sent to this wallet.
                In addition to winning the prize the contract ensures that all the inputs to the contract are consolidated, also the controlling NFT is mutated so that the seed for the next round has been set correctly.
                If the players attempt was unsuccessful half of that payment is added to the prize pool.
                In practice this means that this contract is self sustaining and can be continuously used until it runs out of funds without even the developers getting involved.
                It important to note only a winning guess can make any changes to the contract state.
                Of course if you spot any `deliberate` mistakes in the contract, you are entitled to help yourself to the bounty.
            </p>
            <p>In order to prevent fraudulent claims, the smart contract limits how many outputs there are, and how much change is sent back to the contract. 
                This in addition to the`Control Token` as only allowed to mutate in very prescribed ways the the contract expects.
            </p>
            <p>The built-in Bitcoin Cash wallet uses MainNet_js library and using lots on ideas from the Cashonize wallet.</p>
            <p>For debugging the contract and code a special thank you to M. G.</p>
            <p>To hack this contract you need to figure out what the &lt;SECRET SAUCE&gt; is, Maybe there are another ways 🤔</p>
            <pre>
                <code>{obj}</code>
            </pre>
            <button className='btn btn-success m-3' onClick={onThisContractClose}>Close</button>

        </>
    )
}

export default ThisContract