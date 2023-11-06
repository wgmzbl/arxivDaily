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

const app = express();

const datapath = config.datapath;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(expressSession({ secret: config.usercookie, resave: false, saveUninitialized: false, cookie: { maxAge: 86400000 * 365 } }));
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));
passport.use(new LocalStrategy((username, password, done) => {
  bcrypt.compare(password, config.password, (err, result) => {
    if (err) throw err;
    console.log(bcrypt.hashSync(password, 10));
    if (result) {
      console.log('Login successful,');
      return done(null, { username });
    } else {
      return done(null, false, { message: 'Invalid credentials' });
    }
  });
}));

passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  if (username === `${config.username}`) {
    return done(null, { username });
  } else {
    return done(null, false, { message: 'User not found' });
  }
});

function checkIfLogin(req) {
  return req.session && req.session.passport && req.session.passport.user;
}

function checkLogin(req, res, next) {
  if (checkIfLogin(req)) {
    res.locals.loggedIn = true;
    res.locals.user = req.session.user;
  } else {
    res.locals.loggedIn = false;
  }
  next();
}

function check(category, data) {
  if ((/^[a-zA-Z\.]+$/.test(category) && (/^[0-9\.]+$/.test(data)))) {
    return true;
  }
  return false;
}

app.get('/', checkLogin, (req, res) => {
  console.log('rendering index');
  res.render('index', { category: 'math.DG' });
});

app.post('/update-date', (req, res) => {
  // Check if date is read
  const yymmdd = req.body.date;
  const category = req.body.category;
  if (!check(category, yymmdd)) {
    res.json({ message: 'Invalid request!' });
    return;
  }

  fs.readFile(`${datapath}/read.json`, (err, data) => {
    if (err) {
      res.json({ message: 'Invalid request!' });
      return;
    }
    const json = JSON.parse(data);
    if (category in json && yymmdd in json[category] && json[category][yymmdd] == false) {
      json[category][yymmdd] = true;
      fs.writeFile(`${datapath}/read.json`, JSON.stringify(json, null, 2), (err) => {
        if (err) throw err;
        res.json({ message: 'Date updated successfully!' });
        return;
      });
    }
    else {
      res.json({ message: 'Date was already read!' });
    }
    return;
  });
});

app.get('/categories', (req, res) => {
  // Get all categories
  res.json({ categories: config.categories });
});

app.get('/read/:category', (req, res) => {
  // Get read status of a category on a date
  category = req.params.category;
  if (!/^[a-zA-Z\.]+$/.test(category)) {
    res.json({ message: 'Invalid request!' });
    return;
  }

  // check if isread category on date
  fs.readFile(`${datapath}/read.json`, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    if (category in JSON.parse(data)) {
      res.json(JSON.parse(data)[category]);
    }
    else {
      res.json({ message: 'Invalid request!' });
    }
  });
});


app.get('/closedAvaliableData/:category/:data', (req, res) => {
  // Get closed avaliable data of a category on a date
  const category = req.params.category;
  const data = req.params.data;
  if (!check(category, data)) {
    res.json({ message: 'Invalid request!' });
    return;
  }

  fs.readFile(`${datapath}/read.json`, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    res.json(JSON.parse(data)[category]);
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchWithRetry(url, retries = 3, delay = 2000) {
  const attemptFetch = (retryCount) => {
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

app.post('/download', checkLogin, (req, res) => {
  if (!checkIfLogin(req)) {
    return res.json({ error: 'Not logged in' });
  }
  // Download pdf, fetching info and save it to json and md

  const id = req.body.id;
  const yymmdd = req.body.date;
  const type = req.body.type; //interesting or related
  const category = req.body.category;
  if (!check(category, yymmdd)) {
    console.log('invaid category');
    res.json({ message: 'Invalid request!' });
    return;
  }
  if (!(/^[0-9]{4}\.[0-9v]{4,7}$/.test(id))) {
    console.log('invaid id');
    res.json({ message: 'Invalid request!' });
    return;
  }
  if (!/^[a-zA-Z]+$/.test(type)) {
    console.log('invaid type');
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
  console.log('url: ' + url);

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

    if (!obj.hasOwnProperty(id)) {
      obj[id] = {};
      obj[id]['title'] = titlepaper;
      obj[id]['authors'] = authors;
      obj[id]['summary'] = summary;
      obj[id]['url'] = url;
      obj[id]['comments'] = comments;
      obj[id]['subjects'] = subjects;
      obj[id]['submitTime'] = submitTime;

      authorlist = authors.split(', ');
      authorstr = "";
      authorlist.forEach(author => {
        authorname = author.split(' ');
        authorstr += authorname[authorname.length - 1] + ", ";
      });
      authorstr = authorstr.slice(0, -2);
      console.log('Fetching pdf...');
      fetchWithRetry('url-to-download', 3, 2000)
        .then(content => {
          console.log('下载成功，处理内容...');
          const fileName = `${authorstr}-${id.slice(0, 2)}-${titlepaper.replace(/[\.\$\\/:*?"<>|]/g, '')}.pdf`;
          console.log('Write to file ' + fileName);
          fs.writeFileSync(`${datapath}/${type}/${fileName}`, content);
        })
        .then(() => {
          console.log('处理完毕');
        })
        .catch(error => {
          console.error('下载失败:', error);
        });

      let jsonStr = JSON.stringify(obj, null, 2);
      fs.writeFile(`${datapath}/${type}.json`, jsonStr, (err) => {
        if (err) throw err;
      });

      const mdContent = `### **${titlepaper}**\n**${authors}**\n- [PDF Link](${url})\n - Category: ${category}\n- Arxiv ID: ${id}\n- Comments: ${comments}\n- submit time: ${submitTime}\n-  Abstract: ${summary}\n\n`;
      fs.appendFile(`${datapath}/${type}.md`, mdContent, (err) => { console.log(`write to ${datapath}/${type}.md`); });
    }
  });
  res.json({ message: 'Finished' });
});


app.get('/:category/:date', (req, res) => {
  // Get articles of a category on a date
  const category = req.params.category
  const date = req.params.date;
  if (!check(category, date)) {
    res.json({ message: 'Invalid request!' });
  }
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

app.get('/:category', checkLogin, (req, res) => {
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
