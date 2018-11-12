const mysql = require('mysql');
const fs = require('fs');
const request = require('request');
const sizeOf = require('image-size');
const con = mysql.createConnection({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.RDS_PORT
});
const limit = process.env.PROCESS_LIMIT;
let done = 0;
let count = limit;
const startTime = Date.now();

con.connect(err => {
  if (err) {
    throw new Error('Cannot connect to MySQL');
  }

  getAndProcess();
});

const getAndProcess = () => {
  console.log('');
  console.log('======================================================');
  done = 0;
  con.query('SELECT path FROM bm_club_photo WHERE width=0 LIMIT ' + limit, (error, results, fields) => {
    if (error) {
      console.error(error);
      con.end();
      process.exit();
    }

    if (results.length === 0) {
      console.log('Done after ' + ((Date.now() - startTime) / 1000) + ' seconds');
      console.log('I have done the job');
      con.end();
      process.exit();
    }

    count = results.length;
    for (let i = 0; i < results.length; i++) {
      let path = results[i].path;
      if (!path) {
        continue;
      }
      // get width height of photo
      getWidthHeightOfPhoto(path);
    }
  });
};

const getWidthHeightOfPhoto = function (uri) {
  const regex = /[^/]+$/;
  const match = regex.exec(uri);
  if (!match[0]) {
    return;
  }

  const filename = 'tempPhotos/' + match[0];
  request.head(uri, function (err, res, body) {
    request(uri).pipe(fs.createWriteStream(filename)).on('close', () => {
      // get width, height of photo then update to table
      sizeOf(filename, function (err, dimensions) {
        if (err) {
          console.error(err);
          checkDone();
          return;
        }

        con.query('UPDATE bm_club_photo SET width=' + dimensions.width + ', height=' + dimensions.height + ' WHERE path="' + uri + '"', (error, results, fields) => {
          if (error) {
            console.error(error);
            checkDone();
            return;
          }
          fs.unlink(filename, () => {
          });
          checkDone();
        });
      });
      logHeap();
    });
  });
};

const checkDone = () => {
  done++;
  console.log('Done ' + done + '/' + count);
  if (done === count) {
    getAndProcess();
  }
};

const logHeap = () => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
};
