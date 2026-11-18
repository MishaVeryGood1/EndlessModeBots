export function createBotManager(Bots) {
    const bots = [];

    return {
        bots,

        AddBot(spawnData) {
            if (!Bots) {
                return { error: "Bots service is unavailable" };
            }

            try {
                Bots.PoolSize = 10;

                const bot = Bots.CreateHuman(spawnData);

                if (!bot) {
                    return { error: "CreateHuman returned null" };
                }

                bots.push(bot);
                return { bot };
            } catch (error) {
                return {
                    error: String(error)
                };
            }
        },

        RemoveBot() {
            if (bots.length === 0) return;

            const bot = bots.pop();

            try {
                bot.Destroy();
            } catch (error) {
                return { error: String(error) };
            }
        },

        ClearBots() {
            while (bots.length > 0) {
                this.RemoveBot();
            }
        }
    };
}