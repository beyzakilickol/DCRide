//----------------configuration---------------------------
const express = require('express')
const mustacheExpress = require('mustache-express')
const bodyParser = require('body-parser')
const app = express()
var session = require('express-session')
var cors = require('cors')

var closestCar = []

app.use(cors())
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});
// import the pg-promise library which is used to connect and execute SQL on a postgres database
const pgp = require('pg-promise')()
// connection string which is used to specify the location of the database
const connectionString = "postgres://frrnsews:EoJ-dl7OE23qas-6FFzmsPBBCs12F_bH@baasu.db.elephantsql.com:5432/frrnsews"
var pg = require('pg');
var http = require('http').Server(app)
var io = require('socket.io')(http);

var client = new pg.Client(connectionString);
client.connect(function(err) {
  if(err) {
    return console.error('could not connect to postgres', err);
  }
  client.query('SELECT NOW() AS "theTime"', function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    console.log(result.rows[0].theTime);
    // >> output: 2018-08-23T14:02:57.117Z
    client.end();
  });
});
// creating a new database object which will allow us to interact with the database
const db = pgp(connectionString)
const models = require('./models') //sequelize config
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('public'))


app.engine('mustache',mustacheExpress())
app.set('views','./views')
app.set('view engine','mustache')
app.use(session({
  secret: 'cat',
  resave: false,
  saveUninitialized: false
}))
app.listen(3012,function(req,res){
  console.log('listening on *:3012');

});
//-----------------middleware-------------------------------------

let authenticateLogin = function(req,res,next) {

 // check if the user is authenticated
 if(req.session.username || req.session.adminname) {
   next()
 } else {
   res.redirect("/login")
 }

}
app.all("/dashboard/*",authenticateLogin,function(req,res,next){
   next()
})
app.all("/admin",authenticateLogin,function(req,res,next){
   next()
})
app.all("/cars/*",authenticateLogin,function(req,res,next){
   next()
})
//-------------------------------------------
app.get('/',function(req,res){

res.render('index',{username: req.session.username || req.session.adminname, isAdmin : req.session.adminname != null})
})
app.post('/register',function(req,res){
  let username = req.body.username
  let password = req.body.password
  let email = req.body.email
  //------register validation by email, username---------------
  models.Users.findOne({

    where:{
      $or: [
        {
   email: email
 },
 {
   username: username
 }
]
    }
  }).then(function(user){
       if(user != null){
         res.render('Signup', {message : "This username/email is already taken.Please try to register with different credentials"})
       } else {
         models.Users.build({
           username:username,
           email:email,
           password:password
         }).save().then(function(){
           res.redirect('/login')

         })
       }
  })
})


app.get('/register',function(req,res){
  res.render('Signup')
})
app.get('/login',function(req,res){
  res.render('Login')
})

app.post('/login',function(req,res){
  let email = req.body.email
  let password = req.body.password
  models.Users.findOne({
    where:{
      email:email,
      password:password
    }
  }).then(function(user){
    if(user!=null){
    req.session.userid = user.id
    req.session.username = user.username
    res.redirect('/')
  }
  else if (user == null){
    models.Admins.findOne({
      where:{
        email:email,
        password:password
      }
    }).then(function(admin){
      if(admin!=null){
      req.session.adminid = admin.id
      req.session.adminname = admin.username
      res.redirect('/')
    } else {
  res.render('Login',{message: 'Invalid credentials, try again'})
  }

  })
} else{
  res.render('Login',{message: 'Invalid credentials, try again'})
}
}).catch(function(error){
  console.log(error)
})
})
//-----creating admin page----------------
// models.Admins.build({
//   username : 'beyzaAdmin',
//   email: 'beyzaAdmin@gmail.com',
//   password: 'Heyhey11',
// }).save().then(function(){
//   console.log('success')
// })

app.get('/logout',function(req,res){
    req.session.destroy()
    res.redirect('/')
})
app.get('/dashboard/user',function(req,res){
  res.render('userDashboard',{username: req.session.username})

})
app.get('/dashboard/admin',function(req,res){
  res.redirect('/admin')

})
//----------------------------------------------------------
app.post('/customerLocation',function(req,res){
  let pickupGeoLocation = req.body.latlngPickupLocation
   let pickupGeoLocationArray =pickupGeoLocation.split(',')
  let pickupLocationLat = pickupGeoLocationArray[0]
  let pickupLocationLng = pickupGeoLocationArray[1]
  let destinationGeoLocation = req.body.latlngDestination
  let destinationGeoLocationArray = destinationGeoLocation.split(',')
  let DestinationLat  = destinationGeoLocationArray[0]
  let DestinationLng  = destinationGeoLocationArray[1]
  let currentGeoLocation = req.body.currentLatLng
  let currentGeoLocationArray = currentGeoLocation.split(',')
  let currentLat = currentGeoLocationArray[0]
  let currentLng = currentGeoLocationArray[1]
  let userid = req.session.userid
console.log(currentGeoLocation=='')
console.log(pickupGeoLocation=='')
console.log(pickupGeoLocationArray)
var distances = []

models.Cars.findAll().then(function(cars){
  distances =[]
  cars.forEach(function(car){
    if(pickupGeoLocation!=''){
    distances.push({carid: car.id,carLat:car.currentlat,carLng:car.currentlong, carDistance:distance(pickupLocationLat,pickupLocationLng, car.currentlat, car.currentlong)})
  } else {
    distances.push({carid: car.id, carLat:car.currentlat,carLng:car.currentlong, carDistance:distance(currentLat,currentLng, car.currentlat, car.currentlong)})

  }
  })
  console.log(distances)
  let carDistances = distances.map(function(each){
    return each.carDistance
  })
let sortedCarDistances=carDistances.sort(function(a,b) { return a-b; })
console.log(sortedCarDistances[0])

 distances.forEach(function(each){

  if(sortedCarDistances[0] == each.carDistance){

    closestCar.push({id:each.carid, lat:each.carLat, lng:each.carLng})
  }
})

console.log(closestCar)

  let apiData = {carid:closestCar[0].id,closestCarLat:closestCar[0].lat,closestCarLng: closestCar[0].lng,pickupLocationLat:pickupLocationLat, pickupLocationLng:pickupLocationLng,currentLocationLat:currentLat,currentLocationLng:currentLng,destinationLat:DestinationLat,destinationLng:DestinationLng }


res.render("customerLocation",apiData)

})
  })

//--------------find closest car
function deg2rad(deg) {
   return deg * Math.PI / 180
 }
 function distance(lat1, lon1, lat2, lon2) {
   var R = 6371; // Radius of the earth in km
   var dLat = deg2rad(lat2 - lat1); // deg2rad below
   var dLon = deg2rad(lon2 - lon1);
   var a =
     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
     Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
     Math.sin(dLon / 2) * Math.sin(dLon / 2);

   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   var d = R * c; // Distance in km
   return d;
 }

//------------------



app.get('/user/customerLocation',function(req,res){
  res.render('customerLocation')
})

app.use('/admin', express.static('static'))
app.use('/admin', express.static('public'))

app.get('/admin', function (req, res) {
  res.render('carController', {username: req.session.adminname})
})

io.on('connection', function (socket) {
  socket.on('submitCarLocation', function (info) {
    models.Cars.update({
      currentlong: info.carLong,
      currentlat: info.carLat,
    }, {

        where: { id: info.carID }

      })
  })
})
app.post('/allValues',function(req,res){
  let carLocation = req.body.carLocation
  let pickupLocation = req.body.pickupLocation
  let currentLocation = req.body.currentLocation
  let destination = req.body.destination
  let tripDuration = req.body.tripDuration
  let pickupDuration = req.body.pickupDuration
  let cost = req.body.cost
  let carid = req.body.carid
  console.log(pickupLocation)
  console.log(currentLocation)

if(pickupLocation == 'NaN,NaN'){
  models.Transactions.build({
    carstartlocation: carLocation,
    pickuplocation: currentLocation,
    dropofflocation: destination,
    pickupduration: pickupDuration,
    tripduration: tripDuration,
    cost:cost,
    userid: req.session.userid,
    carid: carid
  }).save().then(function(data){
        //?????????????????????throws error when redirected to the same page
  })
} else {
  models.Transactions.build({
    carstartlocation: carLocation,
    pickuplocation: pickupLocation,
    dropofflocation: destination,
    pickupduration: pickupDuration,
    tripduration: tripDuration,
    cost:cost,
    userid: req.session.userid,
    carid: carid
  }).save().then(function(data){
        //?????????????????????throws error when redirected to the same page
  })
}

})
app.get('/cars/:no',function(req,res){
  let carid = req.params.no
  models.Transactions.findAll({where:
  {
    carid : carid
  }}).then(function(transactions){
    console.log(transactions)
    res.render('carHistories',{transactions:transactions, username:req.session.adminname})
  })
})
