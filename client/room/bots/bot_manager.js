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