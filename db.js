const mongoose = require('mongoose')

const connectToDB = async (url) => {
    return mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
}

module.exports = connectToDB