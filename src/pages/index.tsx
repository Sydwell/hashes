import Head from 'next/head'
import HashesWallet, { GlobalWallet } from './HashesWallet'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import ThisContract from './ThisContract'
import SmartContracts from './SmartContracts'
import { contractExecution, currentWinAmountInSats, getContractAddress, getCurrentRound, minBCHtoPlay, opReturnConstruction } from './api/contract_execution'
import { SendRequest, Wallet } from 'mainnet-js'
export let areWeBusy = false
export interface Conditions {
  balance: number,
  prize: number,
  round: number,
  previous: string
}

export interface aDoorState {
  state: string,
  image: string
}

export default function Home() {

  const closeState: aDoorState = { state: "closed", image: "/green-door.png" }
  const openState: aDoorState = { state: "open", image: "/open-door.gif" }
  const winState: aDoorState = { state: "win", image: "/win-door.png" }
  const goatState: aDoorState = { state: "goat", image: "/goat-door.png" }
  const [enoughToggle, setEnoughToggle] = useState(false);
  const [showWinners, setShowWinners] = useState(false)
  const [showGame, setShowGame] = useState(true)
  const [showContract, setShowContract] = useState(false)
  const [showThis, setShowThis] = useState(false)
  const [prize, setPrize] = useState(0)
  const [round, setRound] = useState(0)
  const [submitText, setSubmitText] = useState('Select a Door to Open!')
  const [currentDoor, setCurrentDoor] = useState(0)
  // Use a dummy goatState as state 0 because we use natural counting for doors in-play are 1, 2 and 3 
  const [doorStates, setDoorsStates] = useState<aDoorState[]>([goatState, closeState, closeState, closeState])


  const balanceRef = useRef<HTMLInputElement | null>(null);
  const roundRef = useRef<HTMLInputElement | null>(null);


  useEffect(() => { // Run once on startup
    (async () => {

      const ptWallet = await Wallet.watchOnly(getContractAddress())
      const firstPrize = await ptWallet.getBalance('bch') as number
      const sat2win = await currentWinAmountInSats()
      await processBalance(sat2win)
      ptWallet.watchBalance((balance) => processBalance(balance.bch as number))

      async function processBalance(balance: number) {

        setPrize(sat2win / 100_000_000)
        const newRound = await getCurrentRound()
        setRound((currentRound) => {
          if (currentRound != newRound) { // There was a winner so reset 
            const newState = { ...doorStates }
            newState[1] = closeState
            newState[2] = closeState
            newState[3] = closeState
            setDoorsStates(newState)
          }
          return newRound
        })
       // console.log('Prize set at', sat2win / 100_000_000, `newRound ${newRound} `)
      }

    })();
  }, [])




  const handleCloseThisContract = function (): void {
    setShowWinners(false);
    setShowGame(true)
    setShowContract(false)
    setShowThis(false)
  }

  const handleCloseSmartContracts = function (): void {
    setShowWinners(false);
    setShowGame(true)
    setShowContract(false)
    setShowThis(false)
  }

  async function onClickWinners(event: any) {
    console.log(event)
    setShowWinners(!showWinners);
  }

  async function onClickContract(event: any) {
    console.log(event)
    setShowWinners(false)
    setShowGame(false)
    setShowThis(false)
    setShowContract(true)
  }

  async function onClickThis(event: any) {
    console.log(event)
    setShowWinners(false);
    setShowGame(false)
    setShowContract(false)
    setShowThis(true)
  }

  /**
   * Handles the change in balance bellow and above betting threshold coming.
   * 
   * @param newBalance 
   */
  const handleEnoughToggleChange = function (enough: boolean): void {
    setEnoughToggle(enough)
  }

  /**
   * Track users current guess
   * @param event 
   */
  function onClickDoor(whichDoor: number): void {
    if ((doorStates[whichDoor]).state != "closed") {
      console.log('This door is not close' + whichDoor)
      return
    }

    setSubmitText(`Click here to try Door ${whichDoor}!`)
    setCurrentDoor(whichDoor)

    console.log('' + whichDoor);

  }
  
  /**
   * Three major activities delegated from here.
   * 1) The Op-Return constructed.
   * 2) Payment and Op-Return is sent to the contract.
   * 3) Contract execution is attempted.  
   */
  async function handleGuessSubmit(): Promise<void> {

    if (currentDoor < 1) { // A valid door must be selected
      const newState = { ...doorStates }
      newState[1] = closeState
      newState[2] = closeState
      newState[3] = closeState
      setDoorsStates(newState)
      setSubmitText('Select a Door to Open!')
      return
    }
    areWeBusy = true 
    let submittingValue = currentDoor // We need a second reference
    console.log('/*** handleGuessSubmit() ***/', currentDoor)
    // Ensure react, reacts to the new state  
    const newState = { ...doorStates }
    newState[currentDoor] = openState
    setDoorsStates(newState)
    setSubmitText('Please wait!')
    setCurrentDoor(0)

    if (submittingValue < 1 || submittingValue > 3) {
      throw `Invalid guess, you tried ${submittingValue}, it must be between 1 and 3, inclusively!`
    }
    if (GlobalWallet == null || GlobalWallet == undefined) {
      throw `Trying to use an invalid wallet!`
    }
    let playerPrivateKey = GlobalWallet.privateKey as Uint8Array
    let [ord, fullSig] = await opReturnConstruction(submittingValue, playerPrivateKey)

    let sr: SendRequest = { cashaddr: getContractAddress(), value: minBCHtoPlay, unit: 'bch' }
    let tx = await GlobalWallet.send([sr, ord]);

    setTimeout(async () => {
      let guessResult = await contractExecution(submittingValue, playerPrivateKey, fullSig, tx.txId as string)
      if (guessResult) {
        const newState = { ...doorStates }
        newState[submittingValue] = winState
        setDoorsStates(newState)
        console.log(`MAKE A Noise `)
        setSubmitText('Click to start next round!')
        areWeBusy = false
      } else {
        const newState = { ...doorStates }
        newState[submittingValue] = goatState
        setDoorsStates(newState)
        setSubmitText('Select a Door to Open!')
        areWeBusy = false
      }
    }, 2000)

  }

  return (
    <>
      <Head>
        <title>Hashes for Cashers Too</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="d-flex justify-content-evenly bg-primary-subtle ">
        <section>
          <button className='btn btn-success m-3' onClick={onClickWinners}>Show previous winners</button>
          <button className='btn btn-success m-3' onClick={onClickContract}>How do contracts Work</button>
          <button className='btn btn-success m-3' onClick={onClickThis}>Contract Details</button>
        </section>

      </div>
      <main className="bquest-main m-3 p-3  ">
        <header className="w-100" >
          <h1 className="text-center">Hashes for Cashers</h1>

        </header>
        <section className="w-100 w-sm-100 d-flex flex-wrap  ">

          {showGame && <>
            <section className="w-50">
              <h3 className="my-4">The more your learn, the more you will Earn!</h3>

              <p>Use this site to learn about the power and utility of Bitcoin Cash Tokens and Smart Contracts.</p>

              <p>
                Fund your built-in wallet with some BCH, and get lets a winning!
                This product is in beta mode so please act responsibly.
                Each guess will cost you 0.0002 BCH which is approximately 0.05 USD.
              </p>
              <p>In this first example we have a simple guessing game. Chose the correct door and <b>double</b> your money.
              </p>
              <p>Use your super Ai mind reading powers to guess the number stored in the contract.</p>
              <p>Or better still, learn about contracts, and simply help yourself to the bounty!</p>
              <p>The winning user will receive Prize as indicated, This prize will automatically increase if as losing bets are made.</p>
              <p>When you find the winning number, your wallet will receive the BCH in the prize pool. The contract will automatically selected a new number the next round will start. </p>
              <h3>Good luck</h3>
            </section>
            <section className="w-40 ml-5">
              <HashesWallet onEnoughChange={handleEnoughToggleChange}></HashesWallet>
            </section>
            <br />

            <section className="d-flex justify-content-evenly  flex-wrap">

              <a className="w-25" onClick={() => { onClickDoor(1) }} >
                <Image priority src={(doorStates[1].image)} alt='first door' title='door1' className="door" width='210' height='400' style={{ border: currentDoor == 1 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
              </a>
              <a className="w-25" onClick={() => { onClickDoor(2) }} >
                <Image priority src={(doorStates[2].image)} alt='second door' title='door2' className="door" width='210' height='400' style={{ border: currentDoor == 2 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
              </a>
              <a className="w-25" onClick={() => { onClickDoor(3) }} >
                <Image priority src={(doorStates[3].image)} alt='third door' title='door3' className="door" width='210' height='400' style={{ border: currentDoor == 3 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
              </a>


              {!enoughToggle && <button className='btn btn-lg btn-secondary mx-5 my-3 w-100 pe-none' aria-disabled="true" title='Deposit' tabIndex={-1} >Not enough BCH to play!</button>}
              {enoughToggle && <button className='btn btn-lg btn-primary mx-5 my-3 w-100 ' onClick={handleGuessSubmit} >{submitText}</button>}

              <div className="input-group  mx-5 my-3 w-100 ">
                <span className="input-group-text">PRIZE</span>
                <input value={prize} readOnly type='number' className="form-control pe-none" aria-disabled="true" tabIndex={-1} aria-label="The prize pool" />
                <span className="input-group-text w-5">BCH</span>
              </div>
              <div className="input-group  mx-5 my-3 w-100 ">
                <span className="input-group-text">Playing Round</span>
                <input value={round} readOnly type='number' className="form-control pe-none" aria-disabled="true" tabIndex={-1} aria-label="The prize pool" />
              </div>
            </section>

          </>
          }
          <section>
            {showWinners && <div className='text-center m-3 p-3 text-primary-emphasis bg-primary-subtle border border-primary-subtle rounded-3'>
              <h2>Previous Winners</h2>
              <table>
                <thead><tr><td>Date</td><td>BlockHeight</td><td>Guesses Made</td><td>Winnings</td></tr></thead>
                <tbody><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></tbody>
              </table>
            </div>
            }
            {showThis && <ThisContract onCloseThisContract={handleCloseThisContract}></ThisContract>}
            {showContract && <SmartContracts onCloseSmartContracts={handleCloseSmartContracts}></SmartContracts>
            }

          </section>


        </section>




        <footer className="w-100 text-center"><b>This for Educational Purposes only, Please be careful.</b></footer>
      </main>
    </>
  )
}
