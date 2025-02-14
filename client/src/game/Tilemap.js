import Phaser from "phaser";
import gameConfig from "../shared/GameConfig";
import { GUIState, PlayerState } from "../shared/state/States";
import Utils from "../shared/Utils";
import addStaticTile from "./Statics";

class Tilemap {
    constructor(scene) {
        this.scene = scene;
        // The frame on the ground tileset that is all black.
        this.blackFrame = 4;

        this.mapRows = 0;
        this.mapCols = 0;

        this.createGroundGrid();
        this.createStaticsGrid();
        this.createDarknessGrid();

        this.createBorders();
    }

    createGroundGrid() {
        const viewDiameter = gameConfig.VIEW_DIAMETER;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const { scene } = this;

        this.groundSpritesGrid = [];
        this.groundSpritesContainer = this.scene.add.container();
        this.groundSpritesContainer.setDepth(this.scene.renderOrder.ground);

        for (let row = 0; row < viewDiameter; row += 1) {
            this.groundSpritesGrid[row] = [];
            for (let col = 0; col < viewDiameter; col += 1) {
                const sprite = scene.add.sprite(col * scaledTileSize, row * scaledTileSize, "ground-tileset", 1);
                sprite.setScale(gameConfig.GAME_SCALE);
                sprite.setOrigin(0.5);
                this.groundSpritesGrid[row][col] = sprite;
                this.groundSpritesContainer.add(sprite);
            }
        }
    }

    createStaticsGrid() {
        const viewDiameter = gameConfig.VIEW_DIAMETER;

        this.staticsSpritesGrid = [];
        this.staticsSpritesContainer = this.scene.add.container();
        this.staticsSpritesContainer.setDepth(this.scene.renderOrder.statics);

        // Just create the basic structure of the grid.
        // It gets populated during updateStaticsGrid.
        for (let row = 0; row < viewDiameter; row += 1) {
            this.staticsSpritesGrid[row] = [];
            for (let col = 0; col < viewDiameter; col += 1) {
                this.staticsSpritesGrid[row][col] = null;
            }
        }
    }

    flickerDarkness() {
        if (!GUIState.lightFlickerEnabled) return;

        const darknessSprites = this.darknessSpritesContainer.list;

        darknessSprites.forEach((tile) => {
            if (tile.darknessValue < 1) {
                let newAlpha = tile.darknessValue + Phaser.Math.FloatBetween(
                    -(tile.darknessValue * 0.05), tile.darknessValue * 0.05,
                );
                if (newAlpha > 1) newAlpha = 1;
                else if (newAlpha < 0) newAlpha = 0;
                tile.alpha = newAlpha;
            }
        });
    }

    createDarknessGrid() {
        if (this.flickerLoop) clearInterval(this.flickerLoop);

        this.darknessSpritesGrid = [];
        this.darknessSpritesContainer = this.scene.add.container();
        this.darknessSpritesContainer.setDepth(this.scene.renderOrder.darkness);

        let row;
        let col;
        let darknessValue = 1;
        const { scene } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;

        if (this.scene.boardAlwaysNight === false) {
            if (this.scene.dayPhase === this.scene.DayPhases.Day) darknessValue = 0;
            if (this.scene.dayPhase === this.scene.DayPhases.Dawn) darknessValue = 0.5;
            if (this.scene.dayPhase === this.scene.DayPhases.Dusk) darknessValue = 0.5;
        }

        for (row = 0; row < gameConfig.VIEW_DIAMETER; row += 1) {
            this.darknessSpritesGrid[row] = [];
            for (col = 0; col < gameConfig.VIEW_DIAMETER; col += 1) {
                const sprite = scene.add.sprite(col * scaledTileSize, row * scaledTileSize, "ground-tileset", this.blackFrame);
                sprite.setScale(gameConfig.GAME_SCALE);
                sprite.setOrigin(0.5);
                sprite.alpha = darknessValue;
                sprite.darknessValue = darknessValue;
                this.darknessSpritesGrid[row][col] = sprite;
                this.darknessSpritesContainer.add(sprite);
            }
        }

        // Reposition to around where the player is now.
        const viewRangePixels = viewRange * scaledTileSize;
        const playerX = (PlayerState.col * scaledTileSize) - viewRangePixels;
        const playerY = (PlayerState.row * scaledTileSize) - viewRangePixels;

        this.darknessSpritesGrid.forEach((darknessRow, rowIndex) => {
            darknessRow.forEach((tileSprite, colIndex) => {
                tileSprite.x = playerX + (colIndex * scaledTileSize);
                tileSprite.y = playerY + (rowIndex * scaledTileSize);
            });
        });

        this.flickerLoop = setInterval(this.flickerDarkness.bind(this), 500);
    }

    /**
     * Creates a sprite for each edge of the screen that covers that edge.
     * Used to hide the ugly transition pop-in of new tiles/entities during the player move tween.
     */
    createBorders() {
        this.bordersContainer = this.scene.add.container();
        this.bordersContainer.setDepth(this.scene.renderOrder.borders);

        const gridSize = (
            gameConfig.SCALED_TILE_SIZE
            * gameConfig.VIEW_DIAMETER
            + (gameConfig.SCALED_TILE_SIZE * 2)
        );
        const thickness = (gameConfig.SCALED_TILE_SIZE * 2) + 32;

        const createBorderSprite = (width, height) => {
            const borderSprite = this.scene.add.sprite(0, 0, "ground-tileset", this.blackFrame);
            borderSprite.displayWidth = width;
            borderSprite.displayHeight = height;
            borderSprite.setOrigin(0.5);
            borderSprite.setScrollFactor(0);
            this.bordersContainer.add(borderSprite);
            return borderSprite;
        };

        this.topBorderSprite = createBorderSprite(gridSize, thickness);
        this.bottomBorderSprite = createBorderSprite(gridSize, thickness);
        this.leftBorderSprite = createBorderSprite(thickness, gridSize);
        this.rightBorderSprite = createBorderSprite(thickness, gridSize);

        this.updateBorders();
    }

    /**
     * Sets the black border sprites (that hide the move transition pop-in) to be at the edges of the screen.
     */
    updateBorders() {
        const halfWindowWidth = window.innerWidth / 2;
        const halfWindowHeight = window.innerHeight / 2;
        const gridRangeSize = gameConfig.SCALED_TILE_SIZE * (gameConfig.VIEW_RANGE + 1);
        const halfTileScale = gameConfig.SCALED_TILE_SIZE / 2;
        // When the window resized, set the border covers to be the width/height of the window.
        // Also move them along to be at the edge of the view range to put them to the edge of the tiled area.
        this.topBorderSprite.x = halfWindowWidth;
        this.topBorderSprite.y = halfWindowHeight - gridRangeSize + halfTileScale;

        this.bottomBorderSprite.x = halfWindowWidth;
        this.bottomBorderSprite.y = halfWindowHeight + gridRangeSize - halfTileScale;

        this.leftBorderSprite.x = halfWindowWidth - gridRangeSize + halfTileScale;
        this.leftBorderSprite.y = halfWindowHeight;

        this.rightBorderSprite.x = halfWindowWidth + gridRangeSize - halfTileScale;
        this.rightBorderSprite.y = halfWindowHeight;
    }

    /**
     * Updates the whole ground grid. Used at init and board change. Use the edge ones for player movement.
     */
    updateGroundGrid() {
        const playerRow = PlayerState.row;
        const playerCol = PlayerState.col;
        const { groundSpritesGrid } = this;
        const { currentMapGroundGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewDiameter = gameConfig.VIEW_DIAMETER;
        let row;
        let col;
        let targetRow;
        let targetCol;

        // Change the frame in use by each tile sprite of the ground grid for each tile within the player's view range.
        for (row = 0; row < viewDiameter; row += 1) {
            targetRow = playerRow - viewRange + row;
            for (col = 0; col < viewDiameter; col += 1) {
                targetCol = playerCol - viewRange + col;
                // Check the cell to view is in the current map bounds.
                if (currentMapGroundGrid[targetRow] !== undefined) {
                    if (currentMapGroundGrid[targetRow][targetCol] !== undefined) {
                        groundSpritesGrid[row][col].setFrame(
                            currentMapGroundGrid[targetRow][targetCol],
                        );
                        // eslint-disable-next-line no-continue
                        continue;
                    }
                }
                // If the cell to view is out of the current map bounds, show a black frame for that tile.
                groundSpritesGrid[row][col].setFrame(this.blackFrame);
            }
        }

        // Reposition to around where the player is now.
        const viewRangePixels = viewRange * scaledTileSize;
        const playerX = PlayerState.col * scaledTileSize - viewRangePixels;
        const playerY = PlayerState.row * scaledTileSize - viewRangePixels;

        groundSpritesGrid.forEach((groundRow, rowIndex) => {
            groundRow.forEach((tileSprite, colIndex) => {
                tileSprite.x = playerX + (colIndex * scaledTileSize);
                tileSprite.y = playerY + (rowIndex * scaledTileSize);
            });
        });
    }

    /**
     * Updates the sprites around the edge in the direction that was moved in, as the rest of the data is just shifted and wraps back around.
     */
    updateGroundGridEdgeTop() {
        Utils.shiftMatrixDown(this.groundSpritesGrid);

        const { groundSpritesGrid } = this;
        const { currentMapGroundGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const playerRow = PlayerState.row;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewRangePixels = viewRange * scaledTileSize;
        const playerY = PlayerState.row * scaledTileSize;
        const topRow = groundSpritesGrid[0];
        const mapRow = currentMapGroundGrid[playerRow - viewRange];
        let targetCol;

        topRow.forEach((tileSprite, colIndex) => {
            targetCol = PlayerState.col - viewRange + colIndex;
            // Move this tile sprite position to the other end of the grid.
            tileSprite.y = playerY - viewRangePixels;
            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Update the sprite frame.
                    tileSprite.setFrame(mapRow[targetCol]);
                    return;
                }
            }
            // If the cell to view is out of the current map bounds, show a black frame for that tile.
            tileSprite.setFrame(this.blackFrame);
        });
    }

    updateGroundGridEdgeBottom() {
        Utils.shiftMatrixUp(this.groundSpritesGrid);

        const { groundSpritesGrid } = this;
        const { currentMapGroundGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const playerRow = PlayerState.row;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewRangePixels = viewRange * scaledTileSize;
        const playerY = PlayerState.row * scaledTileSize;
        const bottomRow = groundSpritesGrid[groundSpritesGrid.length - 1];
        const mapRow = currentMapGroundGrid[playerRow + viewRange];
        let targetCol;

        bottomRow.forEach((tileSprite, colIndex) => {
            targetCol = PlayerState.col - viewRange + colIndex;
            // Move this tile sprite position to the other end of the grid.
            tileSprite.y = playerY + viewRangePixels;
            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Update the sprite frame.
                    tileSprite.setFrame(mapRow[targetCol]);
                    return;
                }
            }
            // If the cell to view is out of the current map bounds, show a black frame for that tile.
            tileSprite.setFrame(this.blackFrame);
        });
    }

    updateGroundGridEdgeLeft() {
        Utils.shiftMatrixRight(this.groundSpritesGrid);

        const { groundSpritesGrid } = this;
        const { currentMapGroundGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const startColIndex = 0;
        const playerRow = PlayerState.row;
        const targetCol = PlayerState.col - viewRange;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewRangePixels = viewRange * scaledTileSize;
        const playerX = PlayerState.col * scaledTileSize;
        let mapRow;
        let tileSprite;

        groundSpritesGrid.forEach((row, rowIndex) => {
            mapRow = currentMapGroundGrid[playerRow + rowIndex - viewRange];
            tileSprite = row[startColIndex];
            // Move this tile sprite position to the other end of the grid.
            tileSprite.x = playerX - viewRangePixels;
            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Update the sprite frame.
                    tileSprite.setFrame(mapRow[targetCol]);
                    return;
                }
            }
            // If the cell to view is out of the current map bounds, show a black frame for that tile.
            tileSprite.setFrame(this.blackFrame);
        });
    }

    updateGroundGridEdgeRight() {
        Utils.shiftMatrixLeft(this.groundSpritesGrid);

        const { groundSpritesGrid } = this;
        const { currentMapGroundGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const endColIndex = groundSpritesGrid[0].length - 1;
        const playerRow = PlayerState.row;
        const targetCol = PlayerState.col + endColIndex - viewRange;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewRangePixels = viewRange * scaledTileSize;
        const playerX = PlayerState.col * scaledTileSize;
        let mapRow;
        let tileSprite;

        groundSpritesGrid.forEach((row, rowIndex) => {
            mapRow = currentMapGroundGrid[playerRow + rowIndex - viewRange];
            tileSprite = row[endColIndex];
            // Move this tile sprite position to the other end of the grid.
            tileSprite.x = playerX + viewRangePixels;
            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Update the sprite frame.
                    tileSprite.setFrame(mapRow[targetCol]);
                    return;
                }
            }
            // If the cell to view is out of the current map bounds, show a black frame for that tile.
            tileSprite.setFrame(this.blackFrame);
        });
    }

    /**
     * Updates the whole statics grid. Used at init and board change. Use the edge ones for player movement.
     */
    updateStaticsGrid() {
        // Need to remove all existing sprites, and rebuild the sprites grid.
        // It doesn't work the same here as the ground grid where it is just
        // changing the frame, as statics are more complex with interactivity
        // and custom data, so they need to be instances of the appropriate
        // static tile sprite class.
        const playerRow = PlayerState.row;
        const playerCol = PlayerState.col;
        const { staticsSpritesGrid } = this;
        const { currentMapStaticsGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewDiameter = gameConfig.VIEW_DIAMETER;
        let row;
        let col;
        let targetRow;
        let targetCol;
        let staticTile;

        // Remove.
        staticsSpritesGrid.forEach((staticsRow) => {
            staticsRow.forEach((tileSprite, tileIndex, rowArray) => {
                if (tileSprite) {
                    tileSprite.destroy();
                    // Also remove the reference to the sprite from the grid.
                    rowArray[tileIndex] = null;
                }
            });
        });

        // Add.
        for (row = 0; row < viewDiameter; row += 1) {
            targetRow = playerRow - viewRange + row;
            for (col = 0; col < viewDiameter; col += 1) {
                targetCol = playerCol - viewRange + col;
                // Check the cell to view is in the current map bounds.
                if (currentMapStaticsGrid[targetRow] !== undefined) {
                    if (currentMapStaticsGrid[targetRow][targetCol] !== undefined) {
                        // Empty static grid spaces in the map data are represented as [0].
                        if (currentMapStaticsGrid[targetRow][targetCol][0] !== 0) {
                            staticTile = addStaticTile(
                                targetRow,
                                targetCol,
                                currentMapStaticsGrid[targetRow][targetCol],
                            );
                            staticsSpritesGrid[row][col] = staticTile;
                            this.staticsSpritesContainer.add(staticTile);
                        }
                    }
                }
            }
        }

        // Reposition to around where the player is now.
        const viewRangePixels = viewRange * scaledTileSize;
        const playerX = (PlayerState.col * scaledTileSize) - viewRangePixels;
        const playerY = (PlayerState.row * scaledTileSize) - viewRangePixels;

        staticsSpritesGrid.forEach((staticsRow, rowIndex) => {
            staticsRow.forEach((tileSprite, colIndex) => {
                if (tileSprite) {
                    tileSprite.x = playerX + (colIndex * scaledTileSize);
                    tileSprite.y = playerY + (rowIndex * scaledTileSize);
                }
            });
        });
    }

    updateStaticsGridEdgeTop() {
        Utils.shiftMatrixDown(this.staticsSpritesGrid);

        const { staticsSpritesGrid } = this;
        const { currentMapStaticsGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const topSpritesRow = staticsSpritesGrid[0];
        const targetRow = PlayerState.row - viewRange;
        const playerCol = PlayerState.col;
        let mapRow;
        let targetCol;
        let staticTile;

        // Remove top edge tile sprites.
        topSpritesRow.forEach((tileSprite, colIndex) => {
            if (tileSprite) {
                tileSprite.destroy();
                topSpritesRow[colIndex] = null;
            }
        });

        // Add top edge tile sprites.
        topSpritesRow.forEach((tileSprite, colIndex) => {
            targetCol = playerCol - viewRange + colIndex;
            mapRow = currentMapStaticsGrid[targetRow];

            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Empty static grid spaces in the map data are represented as [0].
                    if (mapRow[targetCol][0] !== 0) {
                        staticTile = addStaticTile(targetRow, targetCol, mapRow[targetCol]);
                        topSpritesRow[colIndex] = staticTile;
                        this.staticsSpritesContainer.add(staticTile);
                    }
                }
            }
        });
    }

    updateStaticsGridEdgeBottom() {
        Utils.shiftMatrixUp(this.staticsSpritesGrid);

        const { staticsSpritesGrid } = this;
        const { currentMapStaticsGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const bottomSpritesRow = staticsSpritesGrid[staticsSpritesGrid.length - 1];
        const targetRow = PlayerState.row + viewRange;
        const playerCol = PlayerState.col;
        let mapRow;
        let targetCol;
        let staticTile;

        // Remove bottom edge tile sprites.
        bottomSpritesRow.forEach((tileSprite, colIndex) => {
            if (tileSprite) {
                tileSprite.destroy();
                bottomSpritesRow[colIndex] = null;
            }
        });

        // Add bottom edge tile sprites.
        bottomSpritesRow.forEach((tileSprite, colIndex) => {
            targetCol = playerCol - viewRange + colIndex;
            mapRow = currentMapStaticsGrid[targetRow];

            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Empty static grid spaces in the map data are represented as [0].
                    if (mapRow[targetCol][0] !== 0) {
                        staticTile = addStaticTile(targetRow, targetCol, mapRow[targetCol]);
                        bottomSpritesRow[colIndex] = staticTile;
                        this.staticsSpritesContainer.add(staticTile);
                    }
                }
            }
        });
    }

    updateStaticsGridEdgeLeft() {
        Utils.shiftMatrixRight(this.staticsSpritesGrid);

        const { staticsSpritesGrid } = this;
        const { currentMapStaticsGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const startColIndex = 0;
        const playerRow = PlayerState.row;
        const targetCol = PlayerState.col - viewRange;
        let mapRow;
        let targetRow;
        let tileSprite;
        let staticTile;

        // Remove right edge tile sprites.
        staticsSpritesGrid.forEach((row) => {
            tileSprite = row[startColIndex];
            if (tileSprite) {
                tileSprite.destroy();
                row[startColIndex] = null;
            }
        });

        // Add left edge tile sprites.
        staticsSpritesGrid.forEach((row, rowIndex) => {
            targetRow = playerRow - viewRange + rowIndex;
            mapRow = currentMapStaticsGrid[targetRow];

            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Empty static grid spaces in the map data are represented as [0].
                    if (mapRow[targetCol][0] !== 0) {
                        staticTile = addStaticTile(targetRow, targetCol, mapRow[targetCol]);
                        row[startColIndex] = staticTile;
                        this.staticsSpritesContainer.add(staticTile);
                    }
                }
            }
        });
    }

    updateStaticsGridEdgeRight() {
        Utils.shiftMatrixLeft(this.staticsSpritesGrid);

        const { staticsSpritesGrid } = this;
        const { currentMapStaticsGrid } = this;
        const viewRange = gameConfig.VIEW_RANGE;
        const endColIndex = staticsSpritesGrid[0].length - 1;
        const playerRow = PlayerState.row;
        const targetCol = PlayerState.col + viewRange;
        let mapRow;
        let targetRow;
        let tileSprite;
        let staticTile;

        // Remove left edge tile sprites.
        // The grid has already been shifted, so they are now They are
        staticsSpritesGrid.forEach((row) => {
            tileSprite = row[endColIndex];
            if (tileSprite) {
                tileSprite.destroy();
                row[endColIndex] = null;
            }
        });

        // Add right edge tile sprites.
        staticsSpritesGrid.forEach((row, rowIndex) => {
            targetRow = playerRow - viewRange + rowIndex;
            mapRow = currentMapStaticsGrid[targetRow];

            // Check the cell to view is in the current map bounds.
            if (mapRow !== undefined) {
                if (mapRow[targetCol] !== undefined) {
                    // Empty static grid spaces in the map data are represented as [0].
                    if (mapRow[targetCol][0] !== 0) {
                        staticTile = addStaticTile(targetRow, targetCol, mapRow[targetCol]);
                        row[endColIndex] = staticTile;
                        this.staticsSpritesContainer.add(staticTile);
                    }
                }
            }
        });
    }

    /**
     * Changes the frame displayed on the given existing static tile.
     * @param {String} tileID - The unique ID of the target tile. Looks like row-col, "147-258".
     * @param {Boolean} active - Whether the static tile is active. Some tiles can be inactive, such as interactables.
     */
    updateStaticTile(tileID, active) {
        /** @type {Static} */
        const staticTile = this.scene.statics[tileID];
        // Cannot update if it doesn't exist.
        if (staticTile === undefined) return;

        if (active === true) {
            staticTile.tileSprite.setFrame(staticTile.tileID);
        }
        else {
            staticTile.tileSprite.setFrame(staticTile.inactiveFrame);
        }
    }

    updateDarknessGrid() {
        const player = this.scene.dynamics[PlayerState.entityID];
        const { lightSources } = this.scene;
        const { darknessSpritesGrid } = this;
        let darknessValue = 0;
        const viewDiameter = gameConfig.VIEW_DIAMETER;

        this.darknessSpritesContainer.visible = true;

        if (this.scene.boardAlwaysNight === true) {
            darknessValue = 1;
        }
        else {
            // Don't bother doing the rest if it is day.
            if (this.scene.dayPhase === this.scene.DayPhases.Day) {
                this.darknessSpritesContainer.visible = false;
                return;
            }
            if (this.scene.dayPhase === this.scene.DayPhases.Dawn) darknessValue = 0.5;
            else if (this.scene.dayPhase === this.scene.DayPhases.Dusk) darknessValue = 0.5;
            else darknessValue = 1;
        }

        // Make the whole thing completely dark.
        let row;
        let col;
        let tile;
        for (row = 0; row < viewDiameter; row += 1) {
            for (col = 0; col < viewDiameter; col += 1) {
                tile = darknessSpritesGrid[row][col];
                tile.alpha = darknessValue;
                tile.darknessValue = darknessValue;
            }
        }

        if (player !== undefined) {
            // this.revealDarkness(player.sprite.x, player.sprite.y, 10);
            this.revealDarkness(PlayerState.row, PlayerState.col, 5);
        }

        // Lighten the area around each light source.
        Object.values(lightSources).forEach((lightSource) => {
            // this.revealDarkness(lightSource.x, lightSource.y, lightSource.lightDistance);
            this.revealDarkness(
                lightSource.row,
                lightSource.col,
                lightSource.spriteContainer.lightDistance,
            );
        });
    }

    updateDarknessGridPosition() {
        // Reposition to around where the player is now.
        const
            scaledTileSize = gameConfig.SCALED_TILE_SIZE;
        const viewRangePixels = gameConfig.VIEW_RANGE * scaledTileSize;
        const playerX = (PlayerState.col * scaledTileSize) - viewRangePixels;
        const playerY = (PlayerState.row * scaledTileSize) - viewRangePixels;

        this.darknessSpritesGrid.forEach((row, rowIndex) => {
            row.forEach((tileSprite, colIndex) => {
                tileSprite.x = playerX + (colIndex * scaledTileSize);
                tileSprite.y = playerY + (rowIndex * scaledTileSize);
            });
        });
    }

    /**
     * Reduces the darkness value of darkness tiles around a target position.
     * @param {Number} rowIn
     * @param {Number} colIn
     * @param {Number} radius - The radius of the light.
     */
    revealDarkness(rowIn, colIn, radius) {
        // TODO: figure out daytime darkness for dark areas, caves etc.
        const radiusPlusOne = radius + 1;
        let rowOffset = -radius;
        let colOffset = -radius;
        const row = (Math.floor(rowIn) + gameConfig.VIEW_RANGE) - PlayerState.row;
        const col = (Math.floor(colIn) + gameConfig.VIEW_RANGE) - PlayerState.col;
        const { darknessSpritesGrid } = this;
        let tile;
        let rowDist;
        let colDist;
        let targetRow;
        let targetCol;
        let distFromCenter;

        for (; rowOffset < radiusPlusOne; rowOffset += 1) {
            for (colOffset = -radius; colOffset < radiusPlusOne; colOffset += 1) {
                targetRow = row + rowOffset;
                targetCol = col + colOffset;

                if (darknessSpritesGrid[targetRow] === undefined) continue; // eslint-disable-line no-continue
                tile = darknessSpritesGrid[targetRow][targetCol];
                if (tile === undefined) continue; // eslint-disable-line no-continue

                rowDist = Math.abs(row - targetRow);
                colDist = Math.abs(col - targetCol);
                distFromCenter = rowDist + colDist;

                if (1 - (distFromCenter / radius) > 0) {
                    tile.alpha -= 1 - (distFromCenter / radius);
                    if (tile.alpha < 0) {
                        tile.alpha = 0;
                    }
                    tile.darknessValue = tile.alpha;
                }
            }
        }
    }

    /**
     * Loads a new map. Updates the world display layers.
     * @param {String} boardName
     */
    loadMap(boardName) {
        Utils.message("Loading map:", boardName);

        this.scene.currentBoardName = boardName;

        // Clear the statics object. This is the only reference to the statics from the previous map, so now they can be GCed.
        this.scene.statics = {};

        // Select the map data grids of the new map.
        this.currentMapGroundGrid = gameConfig.mapsData[boardName].groundGrid;
        this.currentMapStaticsGrid = gameConfig.mapsData[boardName].staticsGrid;

        this.mapRows = this.currentMapGroundGrid.length;
        this.mapCols = this.currentMapGroundGrid[0].length;

        // Make sure the current tween has stopped, so it finishes with moving the tilemap in that direction correctly.
        if (this.scene.playerTween !== null) {
            this.scene.playerTween.stop();
        }

        const actualViewDiameter = gameConfig.VIEW_DIAMETER * gameConfig.SCALED_TILE_SIZE;
        const actualViewSize = (
            gameConfig.SCALED_TILE_SIZE
            + (
                gameConfig.VIEW_DIAMETER
                * gameConfig.SCALED_TILE_SIZE * 2
            )
        );

        // Update the game world bounds. Affects how the camera bumps up against edges.
        this.scene.cameras.main.setBounds(
            -(actualViewDiameter),
            -(actualViewDiameter),
            this.mapCols * actualViewSize,
            this.mapRows * actualViewSize,
        );

        this.updateGroundGrid();
        this.updateStaticsGrid();
        this.updateDarknessGrid();
        this.updateDarknessGridPosition();
    }

    shiftMapUp() {
        this.updateGroundGridEdgeTop();
        this.updateStaticsGridEdgeTop();
        this.updateDarknessGrid();
        this.updateDarknessGridPosition();
    }

    shiftMapDown() {
        this.updateGroundGridEdgeBottom();
        this.updateStaticsGridEdgeBottom();
        this.updateDarknessGrid();
        this.updateDarknessGridPosition();
    }

    shiftMapLeft() {
        this.updateGroundGridEdgeLeft();
        this.updateStaticsGridEdgeLeft();
        this.updateDarknessGrid();
        this.updateDarknessGridPosition();
    }

    shiftMapRight() {
        this.updateGroundGridEdgeRight();
        this.updateStaticsGridEdgeRight();
        this.updateDarknessGrid();
        this.updateDarknessGridPosition();
    }
}

export default Tilemap;
