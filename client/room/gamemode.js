import { DisplayValueHeader } from 'pixel_combats/basic';
import * as room_lib from 'pixel_combats/room';

const {
    room, Game, Players, Inventory, LeaderBoard,
    BuildBlocksSet, Teams, Damage, BreackGraph, Ui,
    Properties, GameMode, Spawns, Timers, TeamsBalancer,
    NewGame, NewGameVote, MapEditor, Bots, Chat
} = room_lib;

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

Damage.GetContext().FriendlyFire.Value =
    GameMode.Parameters.GetBool("FriendlyFire");

BreackGraph.WeakBlocks =
    GameMode.Parameters.GetBool("LoosenBlocks");

BreackGraph.OnlyPlayerBlocksDmg =
    GameMode.Parameters.GetBool("OnlyPlayerBlocksDmg");

BreackGraph.PlayerBlockBoost = true;

Properties.GetContext().GameModeName.Value =
    "GameModes/Team Dead Match";

TeamsBalancer.IsAutoBalance = true;

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
    new DisplayValueHeader("Spawns", "Statistics/Spawns", "Statistics/SpawnsShort"),
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

// ОЧКИ ЗА ВРЕМЯ
scores_timer.OnTimer.Add(function() {
    if (stateProp.Value !== GameStateValue) return;

    for (const player of Players.All) {
        if (player.Team == null) continue;
        player.Properties.Scores.Value += 30;
        addTeamScores(player.Team, 30);
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

// СЧЁТЧИК ВРЕМЕНИ
var elapsedSeconds = 0;

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

elapsedTimer.OnTimer.Add(function() {
    UpdateElapsedClock();
});

// СПАВН КОМАНД
function SpawnTeams() {
    for (const team of Teams) {
        Spawns.GetContext(team).Spawn();
    }
}

// ==================================================
// ЭКСПЕРИМЕНТАЛЬНЫЕ БОТЫ
// ==================================================

function GetBotsList() {
    try {
        return Bots.All;
    } catch (e) {
        return null;
    }
}

// СОЗДАНИЕ БОТА
function CreateTestBot() {
    Ui.GetContext().Hint.Value = "BOT: COMMAND RECEIVED";

    try {
        const spawnGroup = Spawns.SpawnPoints.GetGroup(1);

        if (spawnGroup == null) {
            Ui.GetContext().Hint.Value = "BOT: GROUP NOT FOUND";
            return;
        }

        const spawnPoint = spawnGroup.GetRandomSpawnpoint();

        if (spawnPoint == null) {
            Ui.GetContext().Hint.Value = "BOT: POINT NOT FOUND";
            return;
        }

        Bots.PoolSize = 5;

        const bot = Bots.CreateHuman({
            Position: spawnPoint.Position.ToVector(),
            Rotation: { x: 0, y: 0 },
            SkinId: 11,
            WeaponId: 0
        });

        if (bot == null) {
            Ui.GetContext().Hint.Value = "BOT: CREATE RETURNED NULL";
            return;
        }

        bot.SkinId = 11;
        bot.WeaponId = 0;
        bot.Attack = false;

        Ui.GetContext().Hint.Value = "BOT CREATED";

    } catch (e) {
        Ui.GetContext().Hint.Value = "BOT ERROR";
    }
}

// УДАЛЕНИЕ ОДНОГО БОТА
function RemoveOneBot() {
    try {
        const bots = GetBotsList();

        if (bots == null || bots.length === 0) {
            Ui.GetContext().Hint.Value = "BOT: NONE FOUND";
            return;
        }

        bots[bots.length - 1].Destroy();

        Ui.GetContext().Hint.Value = "BOT: REMOVE CALLED";

    } catch (e) {
        Ui.GetContext().Hint.Value = "BOT REMOVE ERROR";
    }
}

// УДАЛЕНИЕ ВСЕХ БОТОВ
function RemoveAllBots() {
    try {
        const bots = GetBotsList();

        if (bots == null || bots.length === 0) {
            Ui.GetContext().Hint.Value = "BOT: NONE FOUND";
            return;
        }

        for (const bot of bots) {
            bot.Destroy();
        }

        Ui.GetContext().Hint.Value = "BOT: CLEAR CALLED";

    } catch (e) {
        Ui.GetContext().Hint.Value = "BOT CLEAR ERROR";
    }
}

// КОМАНДЫ ЧАТА
Chat.OnMessage.Add(function(message) {
    try {
        if (message.Sender === 0) return;

        const text = message.Text.trim();

        if (text === "/bot_red(+1)") {
            CreateTestBot();
            return;
        }

        if (text === "/bot_red(+5)") {
            for (let i = 0; i < 5; i++) {
                CreateTestBot();
            }
            return;
        }

        if (text === "/bot_red(-1)") {
            RemoveOneBot();
            return;
        }

        if (text === "/bot_clear(All)") {
            RemoveAllBots();
            return;
        }

    } catch (e) {
        Ui.GetContext().Hint.Value = "CHAT COMMAND ERROR";
    }
});

// ЗАПУСК
scores_timer.RestartLoop(30);
SetWaitingMode();