require('dotenv').config()
const express = require('express')
const session = require('express-session')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const GitHubStrategy = require('passport-github').Strategy
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcryptjs')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const app = express()
const PORT = process.env.PORT || 5000
const connectToDB = require('./db')
const User = require('./UserModel')

// mw
app.use(cors({ origin: 'http://localhost:3000', credentials: true}))
app.use(express.json())
app.use(cookieParser())

app.set("trust proxy", 1)
app.use(session({
  secret: "secretcode",
    resave: true,
    saveUninitialized: true,
}))


app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser((user, done) => {
    return done(null, user._id)
})
    
passport.deserializeUser((id, done) => {
  User.findById(id, (err, doc) => {
      return done(null, doc)
    })
})
 

passport.use(new GoogleStrategy({
    clientID: `${process.env.GOOGLE_CLIENT_ID}`,
    clientSecret: `${process.env.GOOGLE_CLIENT_SECRET}`,
    callbackURL: '/api/v1/auth/google/callback'
}, function (accesToken, refreshToken, profile, cb) {
  User.findOne({ googleId: profile.id }, async (err, doc) => {

    if (err) {
      return cb(err, null);
    }

    if (!doc) {
      const newUser = new User({
        googleId: profile.id,
        username: profile.displayName
      });

      await newUser.save();
      cb(null, newUser);
    } else {
      cb(null, doc)
    }
    
  })
}
))

passport.use(new GitHubStrategy({
  clientID: `${process.env.GITHUB_CLIENT_ID}`,
  clientSecret: `${process.env.GITHUB_CLIENT_SECRET}`,
  callbackURL: "/api/v1/auth/github/callback"
},
  function (_, __, profile, cb) {
    User.findOne({ githubId: profile.id }, async (err, doc) => {

      if (err) {
        return cb(err, null);
      }

      if (!doc) {
        const newUser = new User({
          githubId: profile.id,
          username: profile.username
        });

        await newUser.save();
        cb(null, newUser);
      } else {
        cb(null, doc)
      }      
    })

  }
))

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async function (username, password, done) {
  try {
    const user = await User.findOne({ email: username })
    if (!user) {
      return done(null, false)
    } else {
      const matchingPw = await bcrypt.compare(password, user.password)
      if (!matchingPw) {
        return done(null, false)
      } else {
        return done(null, user)
      }
    }
  } catch (e) {
    return done(e)
  }
  })
)

// dit runt wanneer iemand op /api/V1/auth/google link klikt en zorgt hier voor de popup naar een google login form
app.get('/api/v1/auth/google', passport.authenticate('google', { scope: ['profile']}))

// wanneer popup login van hierboven wordt uitgevoerd
app.get('/api/v1/auth/google/callback', passport.authenticate('google', { failureRedirect: 'http://localhost:3000', session: true }), (req, res) => {
    res.redirect('http://localhost:3000/loggedin/')
})


app.get('/api/v1/auth/github', passport.authenticate('github'))

app.get('/api/v1/auth/github/callback',
  passport.authenticate('github', { failureRedirect: 'http://localhost:3000', session: true }),
  function (req, res) {
    res.redirect('http://localhost:3000/loggedin')
  })

app.post('/api/v1/auth/signup', async (req, res) => {
  const { email, password, username } = req.body

  try {
    const user = await User.findOne({ email })
    if (user) {
      throw new Error('User already exists.')
    } else {
      const salt = await bcrypt.genSalt(10)
      const hashedPw = await bcrypt.hash(password, salt)
      const createdUser = await User.create({
        email,
        password: hashedPw,
        username
      })
      req.login(createdUser, function (err) {
        if (!err) {
          res.json({ data: 'ok'})
        } else {
          console.log(err)
        }
      })
    }
  } catch (e) {
    console.log(e)
  }
})

app.post('/api/v1/auth/login', passport.authenticate('local', { failureRedict: 'http://localhost:3000', session: true}) ,(req, res) => {
  res.json({ data: 'ok'})
})

app.get('/api/v1/getuser', (req, res) => {
    res.json({ user: req.user })
})

app.get('/api/v1/auth/logout', (req, res) => {
  if (req.user) {
    req.logout()
    res.json({ data: 'OK'})
  } 
})



const start = async () => {
    try {
      await connectToDB(process.env.MONGO_URI)
      app.listen(PORT, () =>
        console.log(`Server is listening on port ${PORT}...`)
      );
    } catch (e) {
        console.log("Connection error.")
        console.log(e.message)
    }
  }

start()