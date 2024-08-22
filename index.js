import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';

let servers = [
  'http://localhost:3001',
  'http://localhost:3002'
];
const app = express();
let currentServer = 0;
let currentServerUrl;
let overloadedServers = [];
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const availableServers = async () => {
  return servers.length > 0;
};

const checkServers = async () => {
  for (let i = 0; i < servers.length; i++) {
    currentServer = i;
    try {
      const res = await axios.get(servers[i] + '/load');
      if (Number(res.data.load) >= 80) {
        console.log(`Server ${servers[i]} is overloaded, making the request to a different server`);
        if (!overloadedServers.includes(servers[i])) {
          overloadedServers.push(servers[i]);
        }
        servers = servers.filter(server => server !== servers[i]);
        i--;
      } else {
        console.log(`Making request to server ${servers[i]}`);
        break;
      }
    } catch (error) {
      console.log(error);
    }
  }

  for (let i = 0; i < overloadedServers.length; i++) {
    try {
      const res = await axios.get(overloadedServers[i] + '/load');
      if (Number(res.data.load) < 80) {
        if (!servers.includes(overloadedServers[i])) {
          servers.push(overloadedServers[i]);
        }
        overloadedServers = overloadedServers.filter(server => server !== overloadedServers[i]);
      }
    } catch (error) {
      console.log(error);
    }
  }
};

const balancer = async (req, res) => {
  await checkServers();
  const { method, url, headers, body: data } = req;
  currentServerUrl = servers[currentServer];
  const requestUrl = url;
  
  if (!await availableServers()) {
    return res.status(500).json({ error: 'No servers available' });
  }

  console.log(`Request: ${JSON.stringify(headers)} ${JSON.stringify(data)} ${JSON.stringify(method)} ${JSON.stringify(url)}`);

  try {
    const response = await axios({
      url: `${currentServerUrl}${requestUrl}`,
      method,
      headers,
      data
    });
    console.log(`Response from server: ${JSON.stringify(response.data)}`);
    res.json(response.data);
  } catch (error) {
    console.log(`Error forwarding request: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

app.use((req, res) => balancer(req, res))

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});