const MNEMONIC='<mnemonic goes here>'
const CHATBOT_IDENTITY='<identity goes here>'

//set a password, whatsDapp will use it and a salt to aes encrypt all files stored in storage
//if it's undefined no encryption will be done (for dev purpose)
const STORAGE_PW = undefined

const LocalStorageClear = require('./local_storage_clear')
const {WhatsDapp, WhatsDappEvent} = require('whatsdapp')
const path = require('path')
const fs = require('fs-extra')

const run = async () => {

  const storage=getStorage()
  
  //to be suitable for docker try to prepare storage.
  //if it has user data already it will move on, otherwise it will be created
  try {
    await WhatsDapp.prepareEmptyStorage(MNEMONIC, CHATBOT_IDENTITY, storage, STORAGE_PW)
  } catch (e) {
    console.log("Storage seems to be initiated already. Try to move on...")
  }

  //create whatsDapp with NO encryption for better debugging
  //generic profile will be created
  const messenger = await WhatsDapp.createWhatsDapp(storage, STORAGE_PW);

  //incoming message handler: just echo ;)
  const newMsgArrived=async (msg, interlocutor)=>{
    console.log("New message arrived:", msg)

    console.log("Prepare answer")
    const echo = `Received message: "${msg.content}"`

    //tell balance
    const balance = messenger.getCurrentIdentitiesBalance()
    const balanceInfo = `My current balance: ${balance} credits.\nPlease topup some duffs to keep me running 🤓 `

    const answer = `${echo}\n${balanceInfo}`

    //put this in try to keep bot running
    try{
      const sent = await messenger.sendMessage(interlocutor, answer)
      if (!sent) {
        throw new Error("Something went wrong sending echo message.")
      }    
    }catch(e){
      console.error("Something went wrong sending message:",e)
    }
  }
  //connect event
  messenger.on(WhatsDappEvent.NewIncomingMessage, newMsgArrived)

  //start polling until ... forever
  messenger.startPolling();
}
run();


const cleanup = async () => {
  const storage = getStorage();
  const messenger = await WhatsDapp.createWhatsDapp(storage, STORAGE_PW);

  //remove profile from drive
  await messenger.deleteProfileFromDrive();
  //remove all messages from drive
  await messenger.deleteAllSentMessages();
  //delete local storage
  const storagePath = getStoragePath()
  fs.removeSync(storagePath);
  return
}
//if there is need for cleanup profile, uncomment this line for one run (rebuild of docker image is needed to copy updated js files)
//cleanup();


//returns storage object
function getStorage(){
  const storagePath = getStoragePath()

  //create clear (unencrypted) local storage object
  //(you can replace by any other storage implementing StructuredStorage.KVStore)
  return new LocalStorageClear(storagePath)
}

//determines storage path either in appData or in /storage in case of docker
function getStoragePath(){
  let storagePath=null
  //determine if this script runs within docker 
  const isDocker=fs.existsSync('/.dockerenv')
  if(isDocker){
    //if yes, put storage into storage-volume
    const pathInDocker='/storage'
    storagePath = path.join(pathInDocker, 'whatsDappSessions', CHATBOT_IDENTITY)
  }else{
    //else choose appData as usual for node
    const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
    storagePath = path.join(appDataPath, 'whatsDappSessions', CHATBOT_IDENTITY)
  }
  return storagePath
}
