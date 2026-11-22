import * as room_lib from 'pixel_combats/room';

// ==========================================
// НАСТРОЙКИ БОТОВ
// ==========================================

export const BOT_CONFIG = {
    Team: "Red",
    SkinId: 11,
    WeaponId: 0
};

// ==========================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ПОИСК БЛИЖАЙШЕГО ИГРОКА
// ==========================================

function FindNearestPlayer(bot, targetPlayers) {
    if (!bot || !bot.Position || !targetPlayers) {
        return null;
    }

    let nearestPlayer = null;
    let nearestDistance = Infinity;

    for (const player of targetPlayers) {
        if (!player || !player.IsAlive || !player.Position) {
            continue;
        }

        const dx = player.Position.x - bot.Position.x;
        const dz = player.Position.z - bot.Position.z;

        const distance = dx * dx + dz * dz;

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPlayer = player;
        }
    }

    return nearestPlayer;
}

// ==========================================
// СОЗДАНИЕ МЕНЕДЖЕРА БОТОВ
// ==========================================

export function createBotManager(Bots) {
    const bots = [];

    // ==========================================
    // РЕГИСТРАЦИЯ СОЗДАНИЯ БОТА
    // ==========================================

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

        // ==========================================
        // РЕГИСТРАЦИЯ УДАЛЕНИЯ БОТА
        // ==========================================

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

        // ==========================================
        // ДОБАВЛЕНИЕ БОТА
        // ==========================================

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

        // // ==========================================
// СЛЕЖЕНИЕ ЗА ИГРОКОМ ПО ID
// ==========================================

LookAtPlayerById(Players, playerId) {
    const targetPlayer = Players.GetByRoomId(playerId);

    if (!targetPlayer || !targetPlayer.IsAlive) {
        return;
    }

    const currentBots = bots.slice();

    for (const bot of currentBots) {
        if (!bot || !bot.Alive) continue;

        bot.LookAt(targetPlayer.Position);
    }
},

        // ВЫЧИСЛЯЕМ НАПРАВЛЕНИЕ ВЗГЛЯДА
        const dx = targetPlayer.Position.x - bot.Position.x;
        const dy = (targetPlayer.Position.y + 1) - bot.Position.y;
        const dz = targetPlayer.Position.z - bot.Position.z;

        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (length === 0) continue;

        // УСТАНАВЛИВАЕМ НАПРАВЛЕНИЕ ВЗГЛЯДА
        bot.LookDirection = new room_lib.Vector3(
            dx / length,
            dy / length,
            dz / length
        );
    }
},

        // ==========================================
        // ПОВОРОТ ГОЛОВЫ К ИГРОКАМ
        // ==========================================

        LookAtPlayers(targetPlayers) {
            const currentBots = bots.slice();

            for (const bot of currentBots) {
                if (!bot || !bot.Alive) continue;

                const nearestPlayer = FindNearestPlayer(
                    bot,
                    targetPlayers
                );

                if (nearestPlayer) {
                    bot.LookAt(nearestPlayer.Position);
                }
            }
        },

        // ==========================================
        // ПОСТЕПЕННОЕ ПЕРЕМЕЩЕНИЕ К ИГРОКУ
        // ==========================================

        MoveTowardPlayers(targetPlayers) {
            const currentBots = bots.slice();

            // Расстояние перемещения за один вызов
            const step = 0.5;

            // Минимальная дистанция до игрока
            const stopDistance = 2;

            for (const bot of currentBots) {
                if (!bot || !bot.Alive || !bot.Position) {
                    continue;
                }

                const nearestPlayer = FindNearestPlayer(
                    bot,
                    targetPlayers
                );

                if (!nearestPlayer) continue;

                const dx =
                    nearestPlayer.Position.x - bot.Position.x;

                const dz =
                    nearestPlayer.Position.z - bot.Position.z;

                const distance = Math.sqrt(dx * dx + dz * dz);

                // Не приближаемся вплотную
                if (distance <= stopDistance) {
                    bot.LookAt(nearestPlayer.Position);
                    continue;
                }

                if (distance === 0) continue;

                // Вычисляем следующую позицию
                const newX =
                    bot.Position.x + (dx / distance) * step;

                const newZ =
                    bot.Position.z + (dz / distance) * step;

                const newPosition = new room_lib.Vector3(
                    newX,
                    bot.Position.y,
                    newZ
                );

                // Изменяем позицию бота
                bot.Position = newPosition;

                // Сохраняем направление взгляда
                bot.LookAt(nearestPlayer.Position);
            }
        },

        // ==========================================
        // УДАЛЕНИЕ ОДНОГО БОТА
        // ==========================================

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

        // ==========================================
        // УДАЛЕНИЕ ВСЕХ БОТОВ
        // ==========================================

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