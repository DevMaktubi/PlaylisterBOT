const Discord = require("discord.js");
const fs = require("fs");
const readline = require("readline");
const { prefix, token, path } = require("./config.json");
const queue = new Map();
const ytdl = require("ytdl-core");

const client = new Discord.Client();
client.login(token);

client.once("ready", () => {
  console.log(client.user.username + " CONECTADO!");
});
client.once("disconnect", () => {
  console.log(client.user.username + " DESCONECTADO!");
});

function stop(message, serverQueue) {
  if (!message.member.voice.channel) {
    return message.channel.send(
      "Você deve estar em um canal para parar a música!"
    );
  }
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}
function skip(message, serverQueue) {
  if (!message.member.voice.channel) {
    return message.channel.send(
      "Você deve estar em um canal para poder pular a música!"
    );
  }
  if (!serverQueue) {
    return message.channel.send("Não está tocando nenhuma música no momento!");
  }
  serverQueue.connection.dispatcher.end();
}
function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error) => console.log("Erro: \n" + error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Tocando agora: **${song.title}**`);
}
async function criarPlaylist(message, playlistName) {
  if (fs.existsSync(`${path}${playlistName}.txt`)) {
    return message.channel.send("Já existe uma playlist com esse nome.");
  }

  try {
    fs.writeFile(`${path}${playlistName}.txt`, "", (err) => {
      if (err) return console.log(err);
    });
  } catch (err) {
    return message.channel.send("Houve um erro ao criar a playlist.");
  }
  return message.channel.send("Playlist criada com sucesso!");
}
async function addToPlaylist(message, playlistName, url) {
  try {
    fs.appendFileSync(`${path}${playlistName}.txt`, `${url}\n`);
  } catch (e) {
    return message.channel.send(
      "Ocorreu um erro ao salvar a música na playlist " + playlistName
    );
  }
  message.channel.send(
    "URL adicionada na playlist " + playlistName + " com sucesso!"
  );
}
async function delPlaylist(message, playlistName) {
  try {
    fs.unlink(`${path}${playlistName}.txt`, (err) => {
      if (err) throw error;
    });
  } catch (e) {
    return message.channel.send(
      "Ocorreu um erro ao deletar a playlist " +
        playlistName +
        ". Tem certeza que escreveu o nome certo?"
    );
  }
  return message.channel.send(
    "Playlist " + playlistName + " foi deletada com sucesso!"
  );
}
async function delMusic(message, playlistName, url) {
  fs.readFile(`${path}${playlistName}.txt`, { encoding: "utf-8" }, function (
    err,
    data
  ) {
    if (err) throw error;

    let dataArray = data.split("\n"); // convert file data in an array
    const searchKeyword = url; // we are looking for a line, contains, key word 'user1' in the file
    let lastIndex = -1; // let say, we have not found the keyword

    for (let index = 0; index < dataArray.length; index++) {
      if (dataArray[index].includes(searchKeyword)) {
        // check if a line contains the 'user1' keyword
        lastIndex = index; // found a line includes a 'user1' keyword
        break;
      } else {
        return message.channel.send(
          "Não foi encontrado esse url na playlist " + playlistName
        );
      }
    }

    dataArray.splice(lastIndex, 1); // remove the keyword 'user1' from the data Array

    // UPDATE FILE WITH NEW DATA
    // IN CASE YOU WANT TO UPDATE THE CONTENT IN YOUR FILE
    // THIS WILL REMOVE THE LINE CONTAINS 'user1' IN YOUR shuffle.txt FILE
    const updatedData = dataArray.join("\n");
    fs.writeFile(`${path}${playlistName}.txt`, updatedData, (err) => {
      if (err) throw err;
      message.channel.send(
        "Música removida com sucesso da playlist " + playlistName
      );
    });
  });
}
async function showPlaylist(message, playlistName) {
  if (!fs.existsSync(`${path}${playlistName}.txt`)) {
    return message.channel.send("Não existe uma playlist com esse nome.");
  }

  fs.readFile(`${path}${playlistName}.txt`, { encoding: "utf-8" }, function (
    err,
    data
  ) {
    if (err)
      return message.channel.send(
        "Ocorreu um erro ao tentar mostrar a playlist"
      );
    let dataArray = data.split("\n");
    try {
      for (let index = 0; index < dataArray.length - 1; index++) {
        message.channel.send(dataArray[index].trim());
      }
      return message.channel.send("Fim da playlist " + playlistName);
    } catch (e) {
      return message.channel.send(
        "Ocorreu um erro ao tentar mostrar a playlist"
      );
    }
  });
}
async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.channel.send(
      "Você deve estar em um canal para poder me pedir músicas!"
    );
  }
  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
  };
  // Criando o construtor da playlist
  if (!serverQueue) {
    const queueConstruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };
    // Setando a playlist usando o construtor
    queue.set(message.guild.id, queueConstruct);
    // Jogando a música na playlist
    queueConstruct.songs.push(song);

    try {
      // Entrar no voicechat e salvar a conexão de lá
      var connection = await voiceChannel.join();
      queueConstruct.connection = connection;
      // Puxando a função de tocar música
      play(message.guild, queueConstruct.songs[0]);
    } catch (e) {
      console.log("Erro: \n" + e);
      queue.delete(message.guild.id);
      return message.channel.send("Houve um erro.");
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(
      `${song.title} foi adicionado na fila de músicas!`
    );
  }
}

client.on("message", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;
  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}newPlaylist`)) {
    const args = message.content.split(" ");
    criarPlaylist(message, args[1]);
    return;
  } else if (message.content.startsWith(`${prefix}delPlaylist`)) {
    const args = message.content.split(" ");
    delPlaylist(message, args[1]);
    return;
  } else if (message.content.startsWith(`${prefix}addToPlaylist`)) {
    const args = message.content.split(" ");
    addToPlaylist(message, args[1], args[2]);
    return;
  } else if (message.content.startsWith(`${prefix}delMusic`)) {
    const args = message.content.split(" ");
    delMusic(message, args[1], args[2]);
    return;
  } else if (message.content.startsWith(`${prefix}listPlay`)) {
    const args = message.content.split(" ");
    if (!fs.existsSync(`${path}${args[1]}.txt`)) {
      return message.channel.send("Não existe nenhuma playlist com esse nome.");
    }
    let songs = [];
    try {
      const fileStream = fs.createReadStream(`${path}${args[1]}.txt`);
      const r1 = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });
      for await (const line of r1) {
        songs.push(line.toString());
      }
      for (let x = 0; x < songs.length; x++) {
        let newQueue = await queue.get(message.guild.id);
        message.content = `&tocar ${songs[x]}`;
        await execute(message, newQueue);
      }
    } catch (e) {
      console.log(e);
      return message.channel.send(
        "Ocorreu um erro ao tentar carregar a playlist " + playlistName
      );
    }
    return;
  } else if (message.content.startsWith(`${prefix}showPlaylist`)) {
    const args = message.content.split(" ");
    showPlaylist(message, args[1]);
  } else {
    message.channel.send(
      "Comando desconhecido. Comandos: \r\n &play <urldoyt> \r\n &skip \r\n &stop \r\n &newPlaylist <nomesemespaço> \r\n &delPlaylist <nomesemespaço> \r\n &addToPlaylist <nomedaplaylist> <urldoyt> \r\n &listPlay <nomedaplaylist> \r\n &delMusic <nomedaplaylist> <urldoyt>"
    );
    return;
  }
});
