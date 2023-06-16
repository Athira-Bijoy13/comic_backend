const mongooose=require('mongoose')
const url = `mongodb+srv://Nadeem:nadeem@cluster0.4puy9.mongodb.net/comic?retryWrites=true&w=majority`;

const connectionParams={
    useNewUrlParser: true,
    useUnifiedTopology: true 
}
mongooose.connect(url,connectionParams)
    .then( () => {
        console.log('Connected to the database ')
    })
    .catch( (err) => {
        console.error(`Error connecting to the database. n${err}`);
    })