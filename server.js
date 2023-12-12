require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const expressSession = require('express-session');
const fs = require('fs');
const katex = require('katex');
const { title } = require('process');
const bcrypt = require('bcryptjs');
const config = require('./config.json');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Paper = require('./models/Paper');
const mongoSanitize = require('express-mongo-sanitize');
const app = express();
const axios = require('axios');
const joi = require('joi')

const registerSchema = joi.object({
  username: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{5,20}$')).required().error(new Error('Username is not valid! The username must be between 5 and 20 characters long and can only contain letters and numbers!')),
  email: joi.string().email().required().error(new Error('Email address is not valid!')),
  password: joi.string().pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*]{8,32}$')).required().error(new Error('Password is not valid! The password must be between 8 and 32 characters long and can only contain letters, numbers and special characters!')),
  'cf-turnstile-response': joi.string().required().error(new Error('Server Error'))
});

const loginSchema = joi.object({
  username: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{5,20}$')).required().error(new Error('Username is not valid!')),
  password: joi.string().pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*]{8,32}$')).required().error(new Error('Password is not valid!')),
});

const changePasswordSchema = joi.object({
  old: joi.string().pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*]{8,32}$')).required().error(new Error('Password is not valid!')),
  new: joi.string().pattern(new RegExp('^[a-zA-Z0-9!@#$%^&*]{8,32}$')).required().error(new Error('Password is not valid!')),
});

const categoryDateSchema = joi.object({
  category: joi.string().pattern(new RegExp('^[a-zA-Z\.]+$')).required().error(new Error('Category is not valid!')),
  date: joi.string().pattern(new RegExp('^[0-9\.]{6}$')).required().error(new Error('Date is not valid!')),
});

const arxivIdSchema = joi.object({
  id: joi.string().pattern(new RegExp('^[0-9]{4}\.[0-9v]{4,7}$')).required().error(new Error('Id is not valid!')),
});

const saveFavorSchema = joi.object({
  id: joi.string().pattern(new RegExp('^[0-9]{4}\.[0-9v]{4,7}$')).required().error(new Error('Id is not valid!')),
  date: joi.string().pattern(new RegExp('^[0-9\.]{6}$')).required().error(new Error('Date is not valid!')),
  category: joi.string().pattern(new RegExp('^[a-zA-Z\.]+$')).required().error(new Error('Category is not valid!')),
});

const categorySchema = joi.object({
  category: joi.string().pattern(new RegExp('^[a-zA-Z\.]+$')).required().error(new Error('Category is not valid!')),
});

const categoriesSchema = joi.object({
  categories: joi.array().items(joi.string().pattern(new RegExp('^[a-zA-Z\.]+$'))).required().error(new Error('Categories is not valid!')),
});

const validateRequestBody = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
      return res.status(400).send(error.details[0].message);
  }
  next();
};

const validateParams = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.params);
  if (error) {
    console.log(req.body);
      console.log(error);
      return res.status(400).send(error.details[0].message);
  }
  next();
}


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB', err);
});

const datapath = config.datapath;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());
app.use(mongoSanitize());
app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(expressSession({ secret: config.usercookie, resave: false, saveUninitialized: false, cookie: { maxAge: 86400000 * 30 } }));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('register');
});
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('register');
});

app.post('/register', async (req, res) => {
  try {
    const validationResult = registerSchema.validate(req.body);
    if (validationResult.error) {
      res.render('register', { errorMessage: validationResult.error.message });
      return;
    }

    const { username, email, password } = req.body;
    const cfTurnstileResponse = req.body['cf-turnstile-response'];
    const turnstileSecret = '0x4AAAAAAAOHh83ElhOShBA7-lndvyTaahM';
    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const turnstileVerifyResponse = await axios.post(verifyUrl, {
      secret: turnstileSecret,
      response: cfTurnstileResponse
    });
    if (!turnstileVerifyResponse.data.success) {
      res.render('register', { errorMessage: 'Registration failed. Please try it later on.' });
      return;
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.render('register', { errorMessage: 'Username already exists!' });
      return;
    }
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      res.render('register', { errorMessage: 'Email already exists!' });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
  } catch (error) {
    console.log(error);
    res.render('register', { errorMessage: 'Server error! Please try it later on.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const validationResult = loginSchema.validate(req.body);
    const { username, password } = req.body;
    if (validationResult.error) {
      res.json({success: false, message: "Incorrect username or password"});
      return;
    }
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect username or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect username or password' });
    }
    req.session.userId = user.username;
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.log(error);
    res.status(500).send('Server error');
  }
});

function checkIfLogin(req) {
  return req.session && req.session.userId;
}

function checkLogin(req, res, next) {
  if (checkIfLogin(req)) {
    res.locals.loggedIn = true;
    res.locals.user = req.session.userId;
  } else {
    res.locals.loggedIn = false;
  }
  if (req.session.userId === 'admin') {
    res.locals.isAdmin = true;
  }
  else {
    res.locals.isAdmin = false;
  }
  next();
}

function requireLogin(req, res, next) {
  if (!checkIfLogin(req)) {
    res.redirect('/login');
  } else {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!checkIfLogin(req)) {
    res.json({ error: 'Invalid request!' });
    return;
  }
  if (req.session.userId !== 'admin') {
    res.json({ error: 'Invalid request!' });
  } else {
    next();
  }
}

app.get('/', checkLogin, (req, res) => {
  if (checkIfLogin(req)) {
    User.findOne({ username: req.session.userId })
      .then((user) => {
        if (user.categories.length == 0) {
          category = 'math.DG';
        }
        else {
          category = user.categories[0];
        }
        res.render('index', { "category": category });
      });
  }
  else {
    res.render('index', { "category": "math.DG" });
  }
});

app.get('/user', (req, res) => {
  if (!checkIfLogin(req)) {
    res.redirect('/login');
    return;
  }
  res.render('user');
});

app.post('/update-date', validateRequestBody(categoryDateSchema), requireLogin, (req, res) => {
  // Check if date is read
  const yymmdd = req.body.date;
  const category = req.body.category;
  userId = req.session.userId;

  User.findOne({ username: userId })
    .then((user) => {
      if (user.readHistory[category]) {
        if (user.readHistory[category][yymmdd]) {
          res.json({ message: 'Date was already read!' });
          return;
        }
      }
      else {
        user.readHistory[category] = {};
      }
      user.readHistory[category][yymmdd] = true;
      user.markModified('readHistory');
      user.save()
        .then(() => {
          res.json({ message: 'Date updated successfully!' });
          return;
        })
        .catch((err) => {
          res.json({ message: 'Invalid request!' });
          return;
        });
    })
    .catch((err) => {
      res.json({ message: 'Invalid request!' });
      return;
    });
});

app.get('/categories', (req, res) => {
  res.json({ categories: config.categories, categoriesStr: config.categoriesStr });
});

app.get('/getUserCategories', (req, res) => {
  if (!checkIfLogin(req)) {
    res.json({ categories: config.categories, categoriesStr: config.categoriesStr });
    return;
  }
  userId = req.session.userId;
  User.findOne({ username: userId })
    .then((user) => {
      if (user.categories.length == 0) {
        res.json({ categories: config.categories, categoriesStr: config.categoriesStr });
      }
      else {
        res.json({ categories: user.categories, categoriesStr: config.categoriesStr });
      }
    })
    .catch((err) => {
      res.json({ message: 'Invalid request!' });
      return;
    });
});

app.post('/saveCategories', requireLogin, validateRequestBody(categoriesSchema), (req, res) => {
  userId = req.session.userId;
  const categories = req.body.categories;
  User.findOne({ username: userId })
    .then((user) => {
      user.categories = categories;
      user.markModified('categories');
      user.save()
        .then(() => {
          res.json({ message: 'Categories updated successfully!' });
          return;
        })
        .catch((err) => {
          res.json({ message: 'Invalid request!' });
          return;
        });
    })
    .catch((err) => {
      res.json({ message: 'Invalid request!' });
      return;
    });
});

app.post('/changePassword', requireLogin, validateRequestBody(changePasswordSchema), (req, res) => {
  userId = req.session.userId;
  const oldPassword = req.body.old;
  const newPassword = req.body.new;
  User.findOne({ username: userId })
    .then((user) => {
      bcrypt.compare(oldPassword, user.password, (err, result) => {
        if (err) throw err;
        if (result) {
          bcrypt.hash(newPassword, 10, (err, hash) => {
            if (err) throw err;
            user.password = hash;
            user.save()
              .then(() => {
                res.json({ success: true, message: 'Password updated successfully!' });
                return;
              })
              .catch((err) => {
                res.json({ success: false, message: 'Invalid request!' });
                return;
              });
          });
        } else {
          return res.status(401).json({ success: false, message: 'Incorrect password' });
        }
      });
    })
    .catch((err) => {
      res.json({ message: 'Invalid request!' });
      return;
    });
});

app.get('/read/:category', validateParams(categorySchema), async (req, res) => {
  // Get read status of a category on a date
  category = req.params.category;
  fs.readFile(`${datapath}/read.json`, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    if (category in JSON.parse(data)) {
      hasRead = JSON.parse(data)[category];
      if (!checkIfLogin(req)) {
        res.json(hasRead);
        return;
      }
      else {
        userId = req.session.userId;
        User.findOne({ username: userId })
          .then(
            user => {
              if (user.readHistory[category]) {
                for (let key in user.readHistory[category]) {
                  hasRead[key] = true;
                }
              }
              res.json(hasRead);
            }
          )
          .catch(
            err => {
              res.json({ message: 'Invalid request!' });
            }
          );
      }
    }
    else {
      res.json({ message: 'Invalid request!' });
    }
  });
});


app.get('/closedAvaliableDate/:category/:data', validateParams(categoryDateSchema),(req, res) => {
  // Get closed avaliable data of a category on a date
  const category = req.params.category;
  const date = req.params.date;

  fs.readFile(`${datapath}/read.json`, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    res.json(JSON.parse(date)[category]);
  });
});

function getPaperData(id, category, yymmdd) {
  data = "";
  try {
    data = fs.readFileSync(`${datapath}/${category}/${yymmdd}.json`, 'utf-8');
  } catch (err) {
    res.json({ message: 'Invalid request!' });
    return;
  }
  if (!data) {
    return;
  }
  const paperData = JSON.parse(data);
  for (let key in paperData) {
    paperData[key].forEach(entry => {
      if (entry['Arxiv ID'] == id) {
        url = entry['PDF Link'];
        titlepaper = entry['Title'];
        authors = entry['Authors'] ? entry['Authors'] : "";
        summary = entry['Summary'] ? entry['Summary'] : "";
        comments = entry['arxiv_comments'] ? entry['arxiv_comments'] : "";
        subjects = entry['subject'] ? entry['subject'] : {};
        submitTime = entry['SubmitTime'] ? entry['SubmitTime'] : "";
      }
    }
    );
  }
  return { 'url': url, 'title': titlepaper, 'authors': authors, 'summary': summary, 'comments': comments, 'subjects': subjects, 'submitTime': submitTime };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDirectoryExistsSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
function fetchWithRetry(url, retries = 3, delay = 2000) {
  const attemptFetch = (retryCount) => {
    console.log('Attempt', retryCount, 'to fetch', url);
    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Attempt ${retryCount}: Server responded with status ${response.status}`);
        return response;
      })
      .then(response => {
        return response.buffer();
      }
      )
      .catch(error => {
        console.error(error);
        if (retryCount > 1) {
          return sleep(delay).then(() => attemptFetch(retryCount - 1));
        }
        throw error;
      });
  };
  return attemptFetch(retries);
}

app.post('/download', requireAdmin , (req, res) => {
  // Download pdf, fetching info and save it to json and md

  const id = req.body.id;
  const yymmdd = req.body.date;
  const type = req.body.type; //interesting or related
  const category = req.body.category;
  if (!check(category, yymmdd)) {
    console.log('invaid category' + category + ' ' + yymmdd);
    res.json({ message: 'Invalid request!' });
    return;
  }
  if (!(/^[0-9]{4}\.[0-9v]{4,7}$/.test(id))) {
    console.log('invaid id' + id);
    res.json({ message: 'Invalid request!' });
    return;
  }
  if (!/^[a-zA-Z]+$/.test(type)) {
    console.log('invaid type' + type);
    res.json({ message: 'Invalid request!' });
    return;
  }

  const filePath = `${datapath}/${category}/${yymmdd}.json`;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  for (let key in data) {
    data[key].forEach(entry => {
      if (entry['Arxiv ID'] == id) {
        url = entry['PDF Link'];
        titlepaper = entry['Title'];
        authors = entry['Authors'] ? entry['Authors'] : "";
        summary = entry['Summary'] ? entry['Summary'] : "";
        comments = entry['arxiv_comments'] ? entry['arxiv_comments'] : "";
        subjects = entry['subject'] ? entry['subject'] : {};
        submitTime = entry['SubmitTime'] ? entry['SubmitTime'] : "";
      }
    });
  }

  fs.readFile(`${datapath}/${type}.json`, 'utf8', (err, data) => {
    let obj = {}
    if (err) {
      obj = {};
      console.log('read type.json error');
    }
    else {
      try {
        obj = JSON.parse(data);
      }
      catch (err) {
        console.log('invalid json');
        obj = {};
      }
    }
    authorlist = authors.split(', ');
    authorstr = "";
    authorlist.forEach(author => {
      authorname = author.split(' ');
      authorstr += authorname[authorname.length - 1] + ", ";
    });
    authorstr = authorstr.slice(0, -2);
    const fileName = `${authorstr}-${id.slice(0, 2)}-${titlepaper.replace(/[\.\$\\/:*?"<>|]/g, '')}.pdf`;

    if (obj.hasOwnProperty(id)) {
      if (fs.existsSync(`${datapath}/${type}/${fileName}`)) {
        res.json({ message: "File exists" });
        return;
      }
    }
    else {
      obj[id] = {};
      obj[id]['title'] = titlepaper;
      obj[id]['authors'] = authors;
      obj[id]['summary'] = summary;
      obj[id]['url'] = url;
      obj[id]['comments'] = comments;
      obj[id]['subjects'] = subjects;
      obj[id]['submitTime'] = submitTime;


      console.log('Fetching pdf...');

      let jsonStr = JSON.stringify(obj, null, 2);
      fs.writeFile(`${datapath}/${type}.json`, jsonStr, (err) => {
        if (err) throw err;
      });

      const mdContent = `### **${titlepaper}**\n**${authors}**\n- [PDF Link](${url})\n - Category: ${category}\n- Arxiv ID: ${id}\n- Comments: ${comments}\n- submit time: ${submitTime}\n-  Abstract: ${summary}\n\n`;
      fs.appendFile(`${datapath}/${type}.md`, mdContent, (err) => { console.log(`write to ${datapath}/${type}.md`); });
    }

    fetchWithRetry(url, 3, 2000)
      .then(content => {
        console.log('下载成功，处理内容...');

        console.log('Write to file ' + fileName);
        ensureDirectoryExistsSync(`${datapath}/${type}`);
        fs.writeFileSync(`${datapath}/${type}/${fileName}`, content);

      })
      .then(() => {
        res.json({ message: "Success" });
      })
      .catch(error => {
        console.error('下载失败:', error);
        res.json({ message: "Fail" });
      });
  });
});

app.post('/saveFavor', validateRequestBody(saveFavorSchema), requireLogin, (req, res) => {
  userId = req.session.userId;
  id = req.body.id;
  yymmdd = req.body.date;
  category = req.body.category;
  User.findOne({ username: userId })
    .then((user) => {
      if (user.interesting.includes(id)) {
        res.json({ message: 'Article is already added!' });
        return;
      }
      user.interesting.push(id);
      Paper.findOne({ arxivId: id })
        .then((paper) => {
          if (!paper) {
            result = getPaperData(id, category, yymmdd);
            if (!result) {
              return;
            }
            paper = new Paper({ arxivId: id, ...result });
          }
          paper.save()
            .then(() => {
              user.markModified('interesting');
              user.save()
                .then(() => {
                  res.json({ message: 'Success' });
                  return;
                })
                .catch((err) => {
                  console.log(err);
                  return;
                });
            })
            .catch((err) => {
              console.log(err);
              res.json({ message: 'Invalid request!' });
              return;
            });
        })
        .catch((err) => {
          console.log(err);
          return;
        });
    });
});
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.post('/fetchPaperData', requireLogin, validateRequestBody(arxivIdSchema), (req, res) => {
  userId = req.session.userId;
  const { id } = req.body;
  User.findOne({ username: userId })
    .then((user) => {
      if (!user.interesting.includes(id)) {
        res.json({ message: 'Invalid request!' });
        return;
      }
      Paper.findOne({ arxivId: id })
        .then((paper) => {
          if (!paper) {
            res.json({ message: 'Invalid request!' });
            return;
          }
          res.json(paper);
        })
        .catch((err) => {
          console.log(err);
          return;
        });
    });
});

app.post('/fetchInteresting', requireLogin, (req, res) => {
  userId = req.session.userId;
  User.findOne({ username: userId })
    .then((user) => {
      res.json(user.interesting);
    })
    .catch((err) => {
      console.log(err);
      res.json({ message: 'Invalid request!' });
      return;
    });
});

app.post('/deleteInteresting', requireLogin, validateRequestBody(arxivIdSchema), (req, res) => {
  userId = req.session.userId;
  id = req.body.id;
  User.findOne({ username: userId })
    .then((user) => {
      if (!user.interesting.includes(id)) {
        res.json({ message: 'Invalid request!' });
        return;
      }
      user.interesting.splice(user.interesting.indexOf(id), 1);
      user.markModified('interesting');
      user.save()
        .then(() => {
          res.json({ message: 'Success' });
          return;
        })
        .catch((err) => {
          console.log(err);
          res.json({ message: 'Invalid request!' });
          return;
        });
    });
});
app.get('/:category/:date', validateParams(categoryDateSchema), (req, res) => {
  // Get articles of a category on a date
  const category = req.params.category
  const date = req.params.date;
  const filePath = `${datapath}/${category}/${date}.json`;
  if (!fs.existsSync(filePath)) {
    res.json({ message: 'No articles' });
    return;
  }
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Server error');
      return;
    }
    res.json(JSON.parse(data));
  });
});

app.get('/:category', checkLogin, validateParams(categorySchema), (req, res) => {
  // Get all dates of a category
  const category = req.params.category;
  if (!/^[a-zA-Z\.]+$/.test(category)) {
    res.json({ message: 'Invalid request!' });
    return;
  }

  fs.readdir(`${datapath}/${category}`, (err, files) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    res.render('index', { category: category });
  });
});
app.use((req, res, next) => {
  res.status(404).send('Sorry, we cannot find that!');
});

app.listen(config.server.port, () => {
  console.log(`Server is running on port ${config.server.port}`);
});
