const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const expressSession = require('express-session');
const fs = require('fs');
// const helmet = require('helmet');
const { title } = require('process');
const bcrypt = require('bcryptjs');
const config = require('./config.json');

const app = express();

const datapath = config.datapath;
const username = config.username;
const password = config.password;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 配置Helmet以设置安全HTTP头
// app.use(helmet());
// 设置Ehttps://code.jquery.com
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
  res.send('<form method="post" action="/login"><input type="text" name="username"><input type="password" name="password"><button type="submit">Login</button></form>');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

// 设置身份验证策略
passport.use(new LocalStrategy((username, password, done) => {
  // 这里应该检查用户名和密码
  bcrypt.compare(password, config.password, (err, result) => {
    if (err) throw err;
    console.log(bcrypt.hashSync(password, 10));
    if (result) {
      console.log('Login successful,');
      // req.session.user = username;
      // req.session.usercookie = config.usercookie;
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

// 全局身份验证检查中间件
app.use((req, res, next) => {
  if (req.session.usercookie = config.usercookie) {
    return next();
  }
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login');
  }
});


app.get('/', (req, res) => {
  console.log('rendering index');
  res.render('index');
});

app.post('/update-date', (req, res) => {
  const yymmdd = req.body.date;
  console.log(yymmdd);

  fs.readFile(`${datapath}/read.json`, (err, data) => {
    if (err) throw err;
    const json = JSON.parse(data);
    json[yymmdd] = true;
    fs.writeFile(`${datapath}/read.json`, JSON.stringify(json, null, 2), (err) => {
      if (err) throw err;
      res.json({ message: 'Date updated successfully!' });
    });
  });
});

app.get('/read', (req, res) => {
  fs.readFile(`${datapath}/read.json`, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    res.json(JSON.parse(data));
  });
});

app.post('/download', (req, res) => {
  const id = req.body.id;
  const yymmdd = req.body.date;
  const type = req.body.type;
  const filePath = `${datapath}/data/${yymmdd}.json`;

  console.log(id);
  console.log("date: " + yymmdd);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  data.forEach(entry => {
    if (entry['Arxiv ID'] == id) {
      url = entry['PDF Link'];
      titlepaper = entry['Title'];
      authors = entry['Authors'];
      summary = entry['Summary'];
    }
  });
  console.log('url: ' + url);

  fs.readFile(`${datapath}/${type}.json`, 'utf8', (err, data) => {
    let obj = {}
    if (err) {
      obj = {};
      console.log('read type.json error');
    }
    else {
      console.log(data); try { obj = JSON.parse(data); }
      catch (err) { console.log('invalid json'); obj = {} }
    }

    if (!obj.hasOwnProperty(id)) {
      obj[id] = {};
      obj[id]['title'] = titlepaper;
      obj[id]['authors'] = authors;
      obj[id]['summary'] = summary;
      obj[id]['url'] = url;

      authorlist = authors.split(', ');
      authorstr = "";
      authorlist.forEach(author => {
        authorname = author.split(' ');
        authorstr += authorname[authorname.length - 1] + ", ";
      });
      authorstr = authorstr.slice(0, -2);
      console.log('Fetching pdf...');
      fetch(url).then(response => {
        if (response.ok) {
          return response.buffer();
        }
      })
        .then(buffer => {
          const fileName = `${authorstr}-${id.slice(0, 2)}-${titlepaper.replace(/[\.\$\\/:*?"<>|]/g, '')}.pdf`;
          console.log(fileName);
          fs.writeFileSync(`${datapath}/${type}/${fileName}`, buffer);
        });
      console.log('save md');

      let jsonStr = JSON.stringify(obj, null, 2);
      fs.writeFile(`${datapath}/${type}.json`, jsonStr, (err) => {
        if (err) throw err;
        console.log('Data written to file');
      });

      const mdContent = `### **${titlepaper}**\n**${authors}**\n- [PDF Link](${url})\n- Abstract: ${summary}\n\n`;
      fs.appendFile(`${datapath}/${type}.md`, mdContent, (err) => {console.log(err)});
      // res.json({ message: 'Downloaded successfully!' });
      // return;
    }
  });
  res.json({ message: 'Finished' });
});
app.get('/data/:date', (req, res) => {
  const date = req.params.date;
  const filePath = `${datapath}/data/${date}.json`;
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

app.listen(config.server.port, () => {
  console.log(`Server is running on port ${config.server.port}`);
});
