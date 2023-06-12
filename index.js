const express = require('express');
const cors = require('cors')
const path = require('path')
const multer = require('multer')
const Tesseract = require('tesseract.js')
const gTTS = require('gtts');
var player = require('play-sound')(opts = {})
const { spawnSync } = require('child_process');
const sound = require('sound-play');
const { log } = require('console');
const fs = require('fs')
const {PythonShell} = require('python-shell')
const app = express();
const port = 8800;

app.use(express.json())
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images/')
  },
  filename: function (req, file, cb) {
    req.filename = Date.now() + '-' + file.originalname
    cb(null, Date.now() + '-' + file.originalname)
  }

})
let file1
const upload = multer({
  storage: storage,



})
app.use(cors())
app.get("/",(req,res)=>{
  res.send("hy")
})
app.get("/test",(req,res)=>{
  const pythonScript = __dirname+'/balloon.py';
  const pythonProcess = spawnSync('python', [pythonScript]);
  console.log(pythonProcess)
  // PythonShell.runString('x=1+1;print(x)', null).then(messages=>{
  //   console.log('finished',messages);
  // });
})
app.post('/upload', upload.single('image'), async (req, res) => {


  console.log(req.filename);
  res.status(200).send({
    status: "ok",
    msg: "img uploaded",
    data: req.filename
  })


})

app.get('/read-text/:filename', async (req, res) => {



  // const worker = await Tesseract.createWorker({
  //   lang: ['eng','fin'],
  //   oem: 1,     
  //   psm: 9,
  //   tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',

  // });

  // await worker.load();
  // await worker.loadLanguage('eng');
  // await worker.initialize('eng');
  // const image = 'D:/College of Engineering Trivandrum/interships/book/r.png'
  // // await worker.setParameters({
  // //   tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  // // });
  // const { data: { text } } =  await worker.recognize(image);
  // console.log(text);


  let text
  // Path to your Python script
  const pythonScript = __dirname+'/balloon.py';


  const pythonArgs = [ __dirname+'/balloon.py/'+ req.params.filename];

  // Spawn a new Python process
  const pythonProcess = spawnSync('python3', [pythonScript]);
  console.log(pythonProcess)
  // Listen for data from the Python process (stdout and stderr)
  if (pythonProcess.status === 0) {
    // Execution completed successfully
    console.log('Python script executed successfully');

    text = pythonProcess.stdout.toString()
  }
   else {
    // Execution failed
    console.error('Error executing Python script');
    console.error('stderr:', pythonProcess.stderr.toString());
  }

  // Listen for the Python process to exit
  // await pythonProcess.on('close', (code) => {
  //   console.log(`Python process exited with code ${code}`);
  // });
  let speechtext = ''
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] != '\'')
      speechtext = speechtext.concat(text[i])
  }

  console.log(speechtext);
  let speech = 'Text to speech converted!';
  const gtts = new gTTS(speechtext, 'en');


  const voice = './audio/' + req.params.filename + '.mp3'
  let Output
  gtts.save(voice, function (err, result1) {
    if (err) { throw new Error(err); }
    console.log("huaia");

    const result = "data:audio/ogg;base64," + fs.readFileSync('./audio/' + req.params.filename + '.mp3', 'base64').toString("base64");




    res.send({
      status: 'ok',
      data: result
    });
    // });

  });
  //  await sound.play('Voice.mp3')

})

app.listen(port, async () => {

  console.log("running on port " + __dirname+'\\balloon.py');

})
