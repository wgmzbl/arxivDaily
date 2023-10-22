const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const { title } = require('process');

const app = express();

const datapath = '.';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
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
    if (err) throw err;
    let obj = JSON.parse(data);

    if (!obj.hasOwnProperty(id)) {
      obj[id] = {};
      obj[id]['title'] = titlepaper;
      obj[id]['authors'] = authors;
      obj[id]['summary'] = summary;
      obj[id]['url'] = url;

      authorlist = authors.split(', ');
      authorstr="";
      authorlist.forEach(author => {
        authorname=author.split(' ');
        authorstr += authorname[authorname.length-1]+", ";
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
      fs.appendFileSync(`${datapath}/${type}.md`, mdContent);
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

app.listen(3001, () => {
  console.log('Server is running on port 3000');
});
