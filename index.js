require('./db')
const express = require('express');
const cors = require('cors')
const path = require('path')
const multer = require('multer')
const Tesseract = require('tesseract.js')
const gTTS = require('gtts');
var player = require('play-sound')(opts = {})
const { spawn, spawnSync } = require('child_process');
const sound = require('sound-play');
const { log } = require('console');
const fs = require('fs')
const {PythonShell} = require('python-shell')
const axios=require('axios');
const Carousel = require('./imagemodel');
const app = express();
const port = 8800;
const {sharp}=require('sharp')
app.use(express.json())
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname)
  },
  filename: function (req, file, cb) {
    req.filename = Date.now() + '-' + file.originalname
    cb(null, Date.now() + '-' + file.originalname)
  }
})
let file1
const hosturl=true?"https://comic-backend.vercel.app":"http://localhost:8800"
const upload = multer({})
app.use(cors())
app.get("/",(req,res)=>{
  res.send("hy")
})

app.get("/test1",(req,res)=>{
  const pythonScript = __dirname+'/balloon.py';
  const pythonProcess = spawn('python', [pythonScript]);
  pythonProcess.stdout.on('data from', function (data) {
    console.log('Pipe data from python script ...',data.toString());
    dataToSend = data.toString();
   });
  
})

app.get("/test",(req,res)=>{
  const pythonScript = __dirname+'/balloon.py';
  const pythonProcess = spawnSync('python', [pythonScript]);
  pythonProcess.stdout.on('data from', function (data) {
    console.log('Pipe data from python script ...',data.toString());
    dataToSend = data.toString();
   });
  
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
app.get("/image/:id", async (req, res) => {
    try {
      const _id = req.params.id;
      const carousel = await Carousel.findById(_id);
  
      if (!carousel) {
        throw new Error("Carousel image not found");
      }
      res.set("Content-Type", "image/png");
      res.status(200).send(carousel.carouselImage);
    } catch (e) {
      res.status(400).send({
        status:"failed",
        msg: e.message,
      });
    }
  });

app.post('/read-text', upload.single('image'),async (req, res) => {

    try {
        const carousel=new Carousel();
        const buffer=req.file.buffer;
        carousel.carouselImage=buffer;
            await carousel.save();
            console.log({
                status:'ok',
                msg:'carousel added',
                data: "http://localhost:8800/image/"+carousel._id,
              });
              let text
              const pyurl=false?"http://127.0.0.1:5000":"https://image-to-audio-python.vercel.app"
              //https://image-to-audio-python.vercel.app
              const res1=await axios.get(`${pyurl}/convert-text?name=${hosturl}/image/${carousel._id}`)
              console.log(res1.data.data)
              text=res1.data.data
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
    } catch (e) {
        res.status(400).send({
            status:'failed',
          msg: e.message,
        });
    }

  
})

app.listen(port, async () => {

  console.log("running on port " +__dirname+'\\images\\' + 'r');

})
