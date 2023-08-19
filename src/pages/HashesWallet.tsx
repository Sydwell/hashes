
import { ImageI, qrAddress, Wallet, binToHex } from 'mainnet-js'
import { memo, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { CancelWatchFn } from 'mainnet-js/dist/module/wallet/interface';
import { minBCHtoPlay } from './api/contract_execution';

export interface Props {
    onEnoughChange: (newEnough: boolean) => void;
}

export let GlobalWallet: Wallet
let onceOnly = true // Only for wallet instantiation, node because of react strict mode and being a developer mode, instantiation might still be called twice! 

function HashesWallet({ onEnoughChange: onChangeEnough }: Props) {
    const [wallet, setWallet] = useState<Wallet>();
    const [image, setImage] = useState<ImageI>();
    const [toast, setToast] = useState(false);
    const [reveal, doReveal] = useState(false);
    const [showWithdraw, doShowWithdraw] = useState(false);
    const balanceRef = useRef<HTMLInputElement | null>(null);
    const withdrawRef = useRef<HTMLInputElement | null>(null);
    
    /**
     * User clicked withdraw option reveal button.
     */
    async function onClickWithdraw() {
        doShowWithdraw(!showWithdraw);
        doReveal(false);
    }

    /**
     * User clicked withdraw action button.
     */
    async function onActionWithdraw() {
        let withdrawAddress = (withdrawRef.current as HTMLInputElement).value;
        let result = await (wallet as Wallet).sendMax(withdrawAddress)
    }

     /**
     * User clicked "copyToClipboard" icon.
     */
    async function copyAddressToClipboard() {
        var copyText = document.getElementById("myInput")
        setToast(true)
        doReveal(false)
        navigator.clipboard.writeText(wallet?.getTokenDepositAddress() as string)
        setTimeout(() => {
            setToast(false);
        }, 5000)
    }

     /**
     * User clicked reveal seed phrase toggle button.
     */
    async function onClickReveal() {
        doReveal(!reveal);
        setTimeout(() => {
            doReveal(false);
        }, 60000)

    }

    /**
    * @TODO Please Ignore incoming change
    * DO correct incoming value
    */
    async function incoming(txHash: string, thisWallet: Wallet) {
        // let thisPubKey: string = thisWallet.getPublicKey(true) + ''
        let localAddress = thisWallet.getDepositAddress()
        thisWallet.getLastTransaction
        const decoded = await Wallet.util.decodeTransaction(txHash, true);
        /** @TODO how do we handle multiple addresses? */
        let incomingAddress = decoded.vin[0].address + "";
        /* Sum up the output to our address to see exactly how much we are receiving */
        let total = decoded.vout.filter(thisOnly => thisOnly.scriptPubKey.addresses[0] == localAddress).reduce((sum, vo) => sum + vo.value, 0)
        let unitsReceived = Math.ceil((total * 100_000_000) / 10000)
        let repSats = (parseInt(unitsReceived.toString()) + "").padStart(5, '0')
    }

    /**
     * Only for wallet instantiation, node because of react strict mode and being a developer mode, instantiation might still be called twice! 
     */
    useEffect(() => {
     //   if (onceOnly) {
            Wallet.namedExists("pWallet").then((exists) => {
                if (exists) {
                    Wallet.named(`pWallet`).then((pWallet) => {
                        GlobalWallet = pWallet
                        setWallet(pWallet)
                        onceOnly = false
                    })
                } else {
                    Wallet.newRandom(`pWallet`).then((pWallet) => {
                        GlobalWallet = pWallet
                        setWallet(pWallet)
                        onceOnly = false
                    })
                }
            })
     //   }
    }, [])


    /**
     *  should monitor the wallet?
     */
    useEffect(() => {
        let closeFunction: CancelWatchFn;
        (async () => {
            if (wallet != undefined) {
                closeFunction = await wallet.watchAddress(txHash => incoming(txHash, wallet))
                // GlobalWallet = wallet
                let wP = wallet?.privateKey as Uint8Array
                setImage(qrAddress(`${wallet.getTokenDepositAddress()}?amount=0.003`))
                let bal = (await wallet.getBalance("bch")) as number
                if (bal > minBCHtoPlay) {
                    onChangeEnough(true);
                    (balanceRef.current as HTMLInputElement).value = "" + bal
                } else {
                    onChangeEnough(false);
                }
            }
        })()
        return(() => {
            if (closeFunction != null) {
                closeFunction()
            }
        })
    }, [onChangeEnough, wallet])

    return (
        <>
            <div className='text-center m-3 p-3 text-primary-emphasis bg-primary-subtle border border-primary-subtle rounded-3'>
                <h2>My Wallet</h2>
                {image && <Image
                    src={image.src}
                    alt={image.alt}
                    title={image.title}
                    className="lead"
                    width={256}
                    height={256}
                    priority
                />}
                <span className="icon-sizing d-none d-sm-none d-md-inline" title="Copy the Token Address to the Clipboard!" onClick={copyAddressToClipboard}>📋</span>
                {wallet && <div className="{styles.center}">
                    <div className="lead" style={{wordBreak: "break-all"}}>
                        <p>
                            <code><small onClick={copyAddressToClipboard}>{wallet?.getTokenDepositAddress()}</small></code>
                        </p>
                    </div>

                </div>}
                <div className="input-group mb-3  ">
                    <span className="input-group-text ">BALANCE</span>
                    <input ref={balanceRef} type='number' readOnly className="form-control pe-none" aria-disabled="true" tabIndex={-1} aria-label="My Balance" />
                    <span className="input-group-text w-5">BCH</span>
                </div>
                <div className=''>

                    <button className=" btn btn-secondary m-3" title="Reveal backup phrase!" onClick={onClickReveal}>Toggle Seed Phrase</button>
                    <button className=" btn btn-primary m-3" title="Show the Withdraw input!" onClick={onClickWithdraw}>Withdraw</button>
                </div>



                {toast && <div className="alert alert-info" role="alert"><p> Address Copied to Clipboard</p> </div>}
                {reveal && <div className="alert alert-info" role="alert"><p>{wallet?.getSeed().seed}</p> </div>}
                {showWithdraw &&
                    <>
                        <div className="input-group mb-3  ">
                            <input ref={withdrawRef} type='text' className="form-control" aria-label="withdrawAddress" />
                            <button className=" btn btn-primary" title="Show the Withdraw input!" onClick={onActionWithdraw}>OK</button>
                        </div>

                    </>
                }
            </div>
        </>
    )
}

export default memo(HashesWallet)



