export const BOT_CONFIG = {
    Team: "Red",
    SkinId: 11,
    WeaponId: 0
};

export function createBotManager(Bots) {
    const bots = [];

    if (Bots) {
        // Получаем синхронизированные объекты созданных ботов
        Bots.OnNewBot.Add(function(bot, botsService) {
            if (!bot) return;

            bots.push(bot);
        });

        // Убираем бота из списка после удаления
        Bots.OnBotRemove.Add(function(bot, botsService) {
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
                    error: "Bots service is unavailable"
                };
            }

            try {
                Bots.PoolSize = 10;

                const bot = Bots.CreateHuman(spawnData);

                if (!bot) {
                    return {
                        error: "CreateHuman returned null. Возможно, вызов не на сервере."
                    };
                }

                return {
                    success: true,
                    message: "Запрос на создание бота выполнен"
                };

            } catch (error) {
                return {
                    error: String(error)
                };
            }
        },

        RemoveBot() {
            if (bots.length === 0) {
                return {
                    error: "Ботов нет"
                };
            }

            const bot = bots.pop();

            try {
                bot.Destroy();

                return {
                    success: true,
                    message: "Бот удалён"
                };

            } catch (error) {
                return {
                    error: String(error)
                };
            }
        },

        ClearBots