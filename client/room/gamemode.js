import * as basic_lib from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';

const { DisplayValueHeader } = basic_lib;

const {
    room, Game, Players, Inventory, LeaderBoard,
    BuildBlocksSet, Teams, Damage, BreackGraph, Ui,
    Properties, GameMode, Spawns, Timers, TeamsBalancer,
    NewGame, NewGameVote, MapEditor
} = room_lib;

// BOT MANAGER
import { createBotManager } from './bots/bot_manager.js';
const BotManager = createBotManager(room_lib.Bots);

import * as teams from './default_teams.js';
import * as damageScores from './damage_scores.js';
import * as mapScores from './map_scores.js';
import { addTeamScores } from './team_scores.js';

room.PopupsEnable = true;

const WaitingPlayersTime = 10;
const TacticalPreparationTime = 30;

const KILLS_PROP_NAME = "Kills";
const SCORES_PROP_NAME = "Scores";

const WaitingStateValue = "Waiting";
const TacticalPreparationStateValue = "TacticalPreparation";
const GameStateValue = "Game";
const immortalityTimerName = "immortality";

const mainTimer = Timers.GetContext().Get("Main");
const scores_timer = Timers.GetContext().Get("Scores");
const elapsedTimer = Timers.GetContext().Get("ElapsedClock");

const stateProp = Properties.GetContext().Get("State");

// НАСТРОЙКИ УРОНА
Damage.GetContext().FriendlyFire.Value =
    GameMode.Parameters.GetBool("FriendlyFire");

BreackGraph.WeakBlocks =
    GameMode.Parameters.GetBool("LoosenBlocks");

BreackGraph.OnlyPlayerBlocksDmg =
    GameMode.Parameters.GetBool("OnlyPlayerBlocksDmg");

BreackGraph.PlayerBlockBoost = true;

Properties.GetContext().GameModeName.Value =
    "GameModes/Team Dead Match";

// ОТКЛЮЧАЕМ АВТОБАЛАНСИРОВКУ КОМАНД
TeamsBalancer.IsAutoBalance = false;

Ui.GetContext().MainTimerId.Value = mainTimer.Id;

// КОМАНДЫ
const blueTeam = teams.create_team_blue();
const redTeam = teams.create_team_red();

blueTeam.Build.BlocksSet.Value = BuildBlocksSet.Blue;
redTeam.Build.BlocksSet.Value = BuildBlocksSet.Red;

// ЛИДЕРБОРД
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader(KILLS_PROP_NAME, "Statistics/Kills", "Statistics/KillsShort"),
    new DisplayValueHeader("Deaths", "Statistics/Deaths", "Statistics/DeathsShort"),
    new DisplayValueHeader(SCORES_PROP_NAME, "Statistics/Scores", "Statistics/ScoresShort")
];

LeaderBoard.TeamLeaderBoardValue =
    new DisplayValueHeader(SCORES_PROP_NAME, "Statistics\\Scores", "Statistics\\Scores");

LeaderBoard.TeamWeightGetter.Set(function(team) {
    return team.Properties.Get(SCORES_PROP_NAME).Value;
});

LeaderBoard.PlayersWeightGetter.Set(function(player) {
    return player.Properties.Get(SCORES_PROP_NAME).Value;
});

redTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;
blueTeam.Properties.Get(SCORES_PROP_NAME).Value = 0;

Ui.GetContext().TeamProp1.Value = {
    Team: "Blue",
    Prop: SCORES_PROP_NAME
};

Ui.GetContext().TeamProp2.Value = {
    Team: "Red",
    Prop: SCORES_PROP_NAME
};

// ВЫБОР КОМАНД
Teams.OnRequestJoinTeam.Add(function(player, team) {
    team.Add(player);
});

Teams.OnPlayerChangeTeam.Add(function(player) {
    player.Spawns.Spawn();
});

// БЕССМЕРИЕ
Spawns.GetContext().OnSpawn.Add(function(player) {
    player.Properties.Immortality.Value = true;
    player.Timers.Get(immortalityTimerName).Restart(3);
});

Timers.OnPlayerTimer.Add(function(timer) {
    if (timer.Id != immortalityTimerName) return;
    timer.Player.Properties.Immortality.Value = false;
});

// СТАТИСТИКА
Spawns.OnSpawn.Add(function(player) {
    ++player.Properties.Spawns.Value;
});

Damage.OnDeath.Add(function(player) {
    ++player.Properties.Deaths.Value;
});

Damage.OnKillReport.Add(function(victim, killer, report) {
    damageScores.applyKillReportScores(victim, killer, report);
});

MapEditor.OnMapEdited.Add(function(player, details) {
    mapScores.applyMapEditScores(player, details, blueTeam, redTeam);
});

// СЧЁТЧИК УНИЧТОЖЕННЫХ БОТОВ
const botKillsByPlayer = Object.create(null);

// УВЕДОМЛЕНИЕ О СМЕРТИ БОТА
room_lib.Bots.OnBotDeath.Add(function(data) {
    if (!data) return;

    const bot = data.Bot;
    const player = data.Player;

    if (!bot) return;

    if (player) {
        const playerName = player.NickName;

        if (!botKillsByPlayer[playerName]) {
            botKillsByPlayer[playerName] = 0;
        }

        botKillsByPlayer[playerName]++;

        Ui.GetContext().Hint.Value =
            playerName +
            " уничтожил бота №" + bot.Id +
            " | Всего ботов: " + botKillsByPlayer[playerName];

    } else {
        Ui.GetContext().Hint.Value =
            "Бот №" + bot.Id + " уничтожен";
    }
});

// ОЧКИ ЗА ВРЕМЯ
scores_timer.OnTimer.Add(function() {
    if (stateProp.Value !== GameStateValue) return;

    for (const player of Players.All) {
        if (player.Team == null) continue;

        player.Properties.Scores.Value += 30;
        addTeamScores(player.Team, 30);
    }
});

// СОЗДАНИЕ КРАСНОГО БОТА2
function CreateRedBot() {
    const bots = room_lib.Bots;

    if (!bots) {
        return "Bots API недоступен";
    }

    try {
        bots.PoolSize = 10;

        const redSpawnGroup = Spawns.SpawnPoints.GetGroup(2);

        if (!redSpawnGroup || redSpawnGroup.Count === 0) {
            return "В группе Red нет точек спавна";
        }

        const spawnPoint = redSpawnGroup.GetRandomSpawnpoint();

        if (!spawnPoint) {
            return "Не удалось получить точку спавна";
        }

        const spawnText = String(spawnPoint);
        const match = spawnText.match(
            /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\),\s*(-?\d+(?:\.\d+)?)/
        );

        if (!match) {
            return "Не удалось прочитать координаты: " + spawnText;
        }

        const position = new basic_lib.Vector3(
            Number(match[1]),
            Number(match[2]),
            Number(match[3])
        );

        const rotation = new basic_lib.Vector2(
            0,
            Number(match[4])
        );

        const result = BotManager.AddBot({
            Position: position,
            Rotation: rotation,
            WeaponId: 2,
            SkinId: 10
        });

if (!result || !result.success) {
    return "Ошибка создания: " +
        (result && result.error
            ? result.error
            : "Неизвестная ошибка");
}

return "Запрос на создание бота выполнен";

    } catch (error) {
        return "Ошибка создания: " + String(error);
    }
}


// УДАЛЕНИЕ ОДНОГО КРАСНОГО БОТА
function RemoveRedBot() {
    try {
        if (BotManager.bots.length === 0) {
            return "Созданных ботов нет";
        }

        BotManager.RemoveBot();
        return "Запрос на удаление бота выполнен";
    } catch (error) {
        return "Ошибка удаления: " + String(error);
    }
}

// УДАЛЕНИЕ ВСЕХ КРАСНЫХ БОТОВ
function ClearRedBots() {
    try {
        BotManager.ClearBots();
        return "Запрос на удаление всех ботов выполнен";
    } catch (error) {
        return "Ошибка удаления: " + String(error);
    }
}

// СОЗДАНИЕ ПЯТИ КРАСНЫХ БОТОВ
function CreateFiveRedBots() {
    const bots = room_lib.Bots;

    if (!bots) {
        return "Bots API недоступен";
    }

    bots.PoolSize = 10;

    let created = 0;
    let error = "";

    for (let i = 0; i < 5; i++) {
        const result = CreateRedBot();

        if (result === "Запрос на создание бота выполнен") {
            created++;
        } else {
            error = result;
            break;
        }
    }

    return "Запросов на создание: " + created +
        (error ? ". " + error : "");
}

// ЧАТ-КОМАНДЫ БОТОВ
room_lib.Chat.OnMessage.Add(function(message, chat) {
    if (!message || message.Sender === 0) return;

    const text = message.Text;

    if (text === "/bot_red(+1)") {
        Ui.GetContext().Hint.Value = CreateRedBot();
        return;
    }

    if (text === "/bot_red(+5)") {
        Ui.GetContext().Hint.Value = CreateFiveRedBots();
        return;
    }

    if (text === "/bot_red(-1)") {
        Ui.GetContext().Hint.Value = RemoveRedBot();
        return;
    }

    if (text === "/bot_clear(All)") {
        Ui.GetContext().Hint.Value = ClearRedBots();
        return;
    }
});

// ПЕРЕКЛЮЧЕНИЕ СОСТОЯНИЙ
mainTimer.OnTimer.Add(function() {
    switch (stateProp.Value) {
        case WaitingStateValue:
            SetTacticalPreparation();
            break;

        case TacticalPreparationStateValue:
            SetGameMode();
            break;

        case GameStateValue:
            break;
    }
});

// ОЖИДАНИЕ
function SetWaitingMode() {
    stateProp.Value = WaitingStateValue;
    Ui.GetContext().Hint.Value = "Hint/WaitingPlayers";

    Spawns.GetContext().enable = false;
    mainTimer.Restart(WaitingPlayersTime);
}

// ПОДГОТОВКА
function SetTacticalPreparation() {
    stateProp.Value = TacticalPreparationStateValue;
    Ui.GetContext().Hint.Value = "Hint/TacticalPrep";

    const inventory = Inventory.GetContext();

    inventory.Main.Value = false;
    inventory.Secondary.Value = false;
    inventory.Melee.Value = true;
    inventory.Explosive.Value = false;
    inventory.Build.Value = true;

    Damage.GetContext().DamageOut.Value = true;
    Spawns.GetContext().RespawnTime.Value = 0;

    mainTimer.Restart(TacticalPreparationTime);
    Spawns.GetContext().enable = true;

    SpawnTeams();
}

// СЧЁТЧИК ВРЕМЕНИ
var elapsedSeconds = 0;

// БЕСКОНЕЧНЫЙ МАТЧ
function SetGameMode() {
    stateProp.Value = GameStateValue;

    Damage.GetContext().DamageOut.Value = true;

    const inventory = Inventory.GetContext();

    if (GameMode.Parameters.GetBool("OnlyKnives")) {
        inventory.Main.Value = false;
        inventory.Secondary.Value = false;
        inventory.Melee.Value = true;
        inventory.Explosive.Value = false;
        inventory.Build.Value = true;
    } else {
        inventory.Main.Value = true;
        inventory.Secondary.Value = true;
        inventory.Melee.Value = true;
        inventory.Explosive.Value = true;
        inventory.Build.Value = true;
    }

    Spawns.GetContext().RespawnTime.Value = 0;
    Spawns.GetContext().Despawn();

    SpawnTeams();

    elapsedSeconds = 0;

    Ui.GetContext().Hint.Value = "Время: 00:00:00";

    elapsedTimer.RestartLoop(1);
}

// ОБНОВЛЕНИЕ СЧЁТЧИКА
function UpdateElapsedClock() {
    if (stateProp.Value !== GameStateValue) return;

    elapsedSeconds++;

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    const h = String(hours).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");
    const s = String(seconds).padStart(2, "0");

    Ui.GetContext().Hint.Value =
        "Время: " + h + ":" + m + ":" + s;
}

// ==========================================
// СЛЕЖЕНИЕ И ПЕРЕМЕЩЕНИЕ БОТОВ К ИГРОКУ
// ==========================================

elapsedTimer.OnTimer.Add(function() {
    UpdateElapsedClock();

    if (stateProp.Value === GameStateValue) {

        // БОТ СМОТРИТ НА ИГРОКА
        BotManager.LookAtPlayerById(Players, 1);

        // БОТ ПОСТЕПЕННО ПРИБЛИЖАЕТСЯ К ИГРОКУ
        const targetPlayer = Players.GetByRoomId(1);

        if (targetPlayer && targetPlayer.IsAlive) {
            BotManager.MoveTowardPlayers([targetPlayer]);
        }
    }
});

// СПАВН КОМАНД
function SpawnTeams() {
    for (const team of Teams) {
        Spawns.GetContext(team).Spawn();
    }
}

// ЗАПУСК
scores_timer.RestartLoop(30);
SetWaitingMode();