import { Bots } from "pixel_combats/room";

export const BotManager = {
    bots: [],

    AddBot() {
        Bots.PoolSize = 10;

        const bot = Bots.CreateHuman({
            Position: { x: 50, y: 50, z: 50 },
            Rotation: { x: 0, y: 0 },
            WeaponId: 0,
            SkinId: 11
        });

        if (!bot) return null;

        bot.Attack = false;
        this.bots.push(bot);

        return bot;
    },

    RemoveBot() {
        if (this.bots.length === 0) return;

        const bot = this.bots.pop();
        bot.Destroy();
    },

    ClearBots() {
        while (this.bots.length > 0) {
            this.RemoveBot();
        }
    }
};
