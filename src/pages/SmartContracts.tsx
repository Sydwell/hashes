
export interface Props {
    onCloseSmartContracts: () => void;
}

function SmartContracts({  onCloseSmartContracts: onSmartContractsClose }: Props) {
    return (
        <>
             <h2>Smart Contracts</h2>
            <p>Bitcoin Cash Smart Contract are UTXO based! UTXO, is an acronym for an Unspent Transaction Output.</p>
            <p>This has huge significance and the Bitcoin Cash network is able to scale and remain cost effect as a medium of exchange.</p>
            <p>In practice this means that each wallet that has an amount of BCH to spend it controls at least one UTXO. When that wallet performs a useful action such as sending an amount of BCH to another wallet. It publishes a transaction to 
            the Bitcoin Cash Network / Blockchain, transferring the ownership of the UTXO to another wallet.
            </p>
            <p>...</p>
            <button className='btn btn-success m-3' onClick={onSmartContractsClose}>Close</button>
          
        </>
    )
}

export default SmartContracts