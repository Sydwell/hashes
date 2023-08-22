import Head from 'next/head'
import HashesWallet, { GlobalWallet } from './HashesWallet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image, { StaticImageData } from 'next/image'
import ThisContract from './ThisContract'
import SmartContracts from './SmartContracts'
import { contractExecution, currentWinAmountInSats, getContractAddress, getCurrentRound, minBCHtoPlay, opReturnConstruction } from './api/contract_execution'
import { SendRequest, Wallet } from 'mainnet-js'
import closedDoor from '../../public/green-door.png'
import openDoor from '../../public/open-door.gif'
import goatDoor from '../../public/goat-door.png'
import winDoor from '../../public/win-door.png'

export let areWeBusy = false
export interface Conditions {
  balance: number,
  prize: number,
  round: number,
  previous: string
}

export interface aDoorState {
  state: string,
  image: StaticImageData
}

export default function Home() {
  const memoizedCallBack = useCallback((enough: boolean) => handleEnoughToggleChange(enough), [])
  const [showBurger, setShowBurger] = useState(true);
  //let closeState: aDoorState 
  const memoizedClosed: aDoorState = useMemo(() => { const closeState = { state: "closed", image: closedDoor }; return closeState }, [])

  const openState: aDoorState = { state: "open", image: openDoor }
  const winState: aDoorState = { state: "win", image: winDoor }
  const goatState: aDoorState = { state: "goat", image: goatDoor }
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
  const [doorStates, setDoorsStates] = useState<aDoorState[]>([goatState, memoizedClosed, memoizedClosed, memoizedClosed])


  const balanceRef = useRef<HTMLInputElement | null>(null);
  const roundRef = useRef<HTMLInputElement | null>(null);


  const handleBurger = () => {
    setShowBurger((current) => !current);
    console.log(`Prize set at ${showBurger}`)
  };

  useEffect(() => {
    (async () => {
      console.log(` useEffect  `)
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
            newState[1] = memoizedClosed
            newState[2] = memoizedClosed
            newState[3] = memoizedClosed
            setDoorsStates(newState)
          }
          return newRound
        })
        // console.log('Prize set at', sat2win / 100_000_000, `newRound ${newRound} `)
      }

    })();
  }, [memoizedClosed, doorStates])

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
      newState[1] = memoizedClosed
      newState[2] = memoizedClosed
      newState[3] = memoizedClosed
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
      <div ><h1 className="icon-link m-3" onClick={handleBurger}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" className="bi bi-menu-button-wide  d-block d-sm-block d-md-none" viewBox="0 0 16 16">
          <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v2A1.5 1.5 0 0 1 14.5 5h-13A1.5 1.5 0 0 1 0 3.5v-2zM1.5 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-13z" />
          <path d="M2 2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm10.823.323-.396-.396A.25.25 0 0 1 12.604 2h.792a.25.25 0 0 1 .177.427l-.396.396a.25.25 0 0 1-.354 0zM0 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8zm1 3v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2H1zm14-1V8a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2h14zM2 8.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z" />
        </svg>
      </h1>
        {showBurger && <section className="d-flex justify-content-evenly flex-wrap flex-sm-wrap flex-md-nowrap">
          <button className='btn btn-success mx-md-5 mx-3 my-1 w-100 w-md-25' onClick={onClickWinners}>Show previous winners</button>
          <button className='btn btn-success mx-md-5 mx-3 my-1 w-100 w-md-25' onClick={onClickContract}>How do contracts Work</button>
          <button className='btn btn-success mx-md-5 mx-3 my-1 w-100 w-md-25' onClick={onClickThis}>Contract Details</button>


        </section>}
      </div>
      <main className="bquest-main m-3 p-3  ">
        <header className="w-100" >
          <h1 className="text-center">Hashes for Cashers</h1>

        </header>
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
        <section className="w-100 w-md-100 d-flex flex-wrap  justify-content-between">

          {showGame && <>
            <section className="w-sm-100 w-sm-100 ">
              <h3 >The more your learn, the more you will Earn!</h3>

              <p>Use this site to learn about the power and utility of Bitcoin Cash Tokens and Smart Contracts.</p>

              <p>
                Fund your built-in wallet with some BCH, and get lets a winning!</p>
              <p>
                This product is in beta mode so please act responsibly.</p>
              <p>
                Each guess will cost you 0.0002 BCH which is approximately 0.05 USD.
              </p>
              <p>In this first example we have a simple guessing game.</p>
              <p> Chose the correct door and <b>double</b> your money.
              </p>
              <p>Use your super Ai mind reading powers to guess the number stored in the contract.</p>
              <p>Or better still, learn about contracts, and simply help yourself to the bounty!</p>
              <p>The winning user will receive Prize as indicated, </p>
              <p>This prize will automatically increase if as losing bets are made.</p>
              <p>When you find the winning number, your wallet will receive the BCH in the prize pool.</p>
              <p> The contract will automatically selected a new number the next round will start. </p>
              <h3>Good luck</h3>
            </section>
            <section className=" ml-5 ">
              <HashesWallet onEnoughChange={memoizedCallBack}></HashesWallet>
            </section>
            <br />

            <section className="d-flex justify-content-evenly  flex-wrap">

              <a className="w-25" onClick={() => { onClickDoor(1) }} >
                <Image src={(doorStates[1].image)} alt='first door' title='door1' className="door" style={{ maxWidth: "100%", height: "auto", border: currentDoor == 1 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
              </a>
              <a className="w-25" onClick={() => { onClickDoor(2) }} >
                <Image src={(doorStates[2].image)} alt='second door' title='door2' className="door" style={{ maxWidth: "100%", height: "auto", border: currentDoor == 2 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
              </a>
              <a className="w-25" onClick={() => { onClickDoor(3) }} >
                <Image src={(doorStates[3].image)} alt='third door' title='door3' className="door" style={{ maxWidth: "100%", height: "auto", border: currentDoor == 3 ? 'red solid 5px' : 'rgb(247, 241, 194) solid 5px' }} />
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



        </section>




        <footer className="w-100 text-center"><b>This for Educational Purposes only, Please be careful.</b></footer>
      </main>
    </>
  )
}