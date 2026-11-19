import * as room_lib from 'pixel_combats/room';

export const BOT_CONFIG = {
    Team: "Red",
    SkinId: 11,
    WeaponId: 0
};

export function createBotManager(Bots) {
    const bots = [];

    if (Bots) {
        Bots.OnNewBot.Add(function(bot, botsService) {
            if (!bot) return;

            const exists = bots.some(function(item) {
                return item.Id === bot.Id;
            });

            if (!exists) {
                bots.push(bot);
            }
        });

        Bots.OnBotRemove.Add(function(bot, botsService) {
            if (!bot) return;

            const index = bots.findIndex(function(item) {
                return item.Id === bot.Id;
            });

            if (index !== -1) {
                bots.splice(index, 1);
            }
        });
    }

    return {
        bots: bots,

        AddBot(spawnData) {
            if (!Bots) {
                return {
                    success: false,
                    error: "Bots service unavailable"
                };
            }

            try {
                Bots.PoolSize = 10;

                const bot = Bots.CreateHuman(spawnData);

                if (!bot) {
                    return {
                        success: false,
                        error: "CreateHuman returned null"
                    };
                }

                return {
                    success: true
                };

            } catch (error) {
                return {
                    success: false,
                    error: String(error)
                };
            }
        },

        LookAtPlayers(targetPlayers) {
            const currentBots = bots.slice();

            for (const bot of currentBots) {
                if (!bot || !bot.Alive) continue;

                let nearestPlayer = null;
                let nearestDistance = Infinity;

                for (const player of targetPlayers) {
                    if (!player || !player.IsAlive) continue;

                    const dx = player.Position.x - bot.Position.x;
                    const dy = player.Position.y - bot.Position.y;
                    const dz = player.Position.z - bot.Position.z;

                    const distance =
                        dx * dx + dy * dy + dz * dz;

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestPlayer = player;
                    }
                }

                if (nearestPlayer) {
                    bot.LookAt(nearestPlayer.Position);
                }
            }
        },

        MoveTowardPlayers(targetPlayers) {
            const currentBots = bots.slice();
            const step = 0.5;

            for (const bot of currentBots) {
                if (!bot || !bot.Alive) continue;

                let nearestPlayer = null;
                let nearestDistance = Infinity;

                for (const player of targetPlayers) {
                    if (!player || !player.IsAlive) continue;

                    const dx = player.Position.x - bot.Position.x;
                    const dy = player.Position.y - bot.Position.y;
                    const dz = player.Position.z - bot.Position.z;

                    const distance = dx * dx + dy * dy + dz * dz;

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestPlayer = player;
                    }
                }

                if (!nearestPlayer || nearestDistance < 4) continue;

                const dx = nearestPlayer.Position.x - bot.Position.x;
                const dy = nearestPlayer.Position.y - bot.Position.y;
                const dz = nearestPlayer.Position.z - bot.Position.z;

                const distance = Math.sqrt(
                    dx * dx + dy * dy + dz * dz
                );

                if (distance === 0) continue;

                const newPosition = new room_lib.Vector3(
                    bot.Position.x + (dx / distance) * step,
                    bot.Position.y + (dy / distance) * step,
                    bot.Position.z + (dz / distance) * step
                );

                bot.Position = newPosition;
                bot.LookAt(nearestPlayer.Position);
            }
        },

        RemoveBot() {
            if (bots.length === 0) {
                return {
                    success: false,
                    error: "Ботов нет"
                };
            }

            const bot = bots[bots.length - 1];

            try {
                bot.Destroy();

                return {
                    success: true
                };

            } catch (error) {
                return {
                    success: false,
                    error: String(error)
                };
            }
        },

        ClearBots() {
            const currentBots = bots.slice();
            let removed = 0;

            for (const bot of currentBots) {
                try {
                    bot.Destroy();
                    removed++;
                } catch (error) {
                }
            }

            return {
                success: true,
                removed: removed
            };
        }
    };
}