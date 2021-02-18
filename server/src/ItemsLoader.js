const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Utils = require("./Utils");
const ItemsList = require("./ItemsList");
const Item = require("./items/Item");

/**
 * Creates a generic class for an item based on the Item class, or one of it's abstract subclasses.
 * @param {Object} config
 * @param {String} config.name
 * @param {String} [config.extends]
 */
const makeClass = (config) => {
    if (!config.name) {
        Utils.error("Cannot load item config, required property \"name\" is missing.");
    }

    // Use the base Item class to extend from by default.
    let SuperClass = Item;

    // Use a more specific type (i.e. Ammunition, Clothes) to extend from if specified.
    if (config.extends) {
        const pathToCheck = `${__dirname}/items/${config.extends}.js`;
        if (fs.existsSync(pathToCheck)) {
            // eslint-disable-next-line global-require, import/no-dynamic-require
            SuperClass = require(`./items/${config.extends}`);
        }
        else {
            Utils.error(`Failed to load item config from ItemValues.yml for "${config.name}".
          The class to extend from cannot be found for given "extends" property "${config.extends}".
          Full path being checked: "${pathToCheck}"`);
        }
    }

    class GenericItem extends SuperClass { }

    GenericItem.assignPickupType(config.name);

    return GenericItem;
};

const populateList = () => {
    Utils.message("Populating items list.");

    // Import all of the files for items that have their own class file for specific logic.
    // eslint-disable-next-line global-require
    require("require-dir")("items", {
        recurse: true,
        mapKey: (value, baseName) => {
            if (typeof value === "function") {
                if (ItemsList.BY_NAME[baseName]) {
                    Utils.error(`Cannot load item "${baseName}", as it already exists in the items list.`);
                }
                // Don't add abstract classes.
                // Only bother with classes that are actually going to get instantiated.
                if (Object.prototype.hasOwnProperty.call(value, "abstract")) return;

                value.assignPickupType(baseName);
                value.prototype.typeName = baseName;

                ItemsList.BY_NAME[baseName] = value;
            }
        },
    });

    try {
        // Load all of the item configs.
        const itemConfigs = yaml.safeLoad(
            fs.readFileSync(
                path.resolve("./src/configs/ItemValues.yml"), "utf8",
            ),
        );

        itemConfigs.forEach((config) => {
            // Only generate a class for this item if one doesn't already
            // exist, as it might have it's own special logic file.
            if (!ItemsList.BY_NAME[config.name]) {
                ItemsList.BY_NAME[config.name] = makeClass(config);
            }
        });
    }
    catch (error) {
        Utils.error(error);
    }

    // Check all of the items are valid. i.e. are a class/function.
    Object.entries(ItemsList.BY_NAME).forEach(([name, ItemType]) => {
        if (typeof ItemType !== "function") {
            Utils.error("Invalid item type added to ItemsList:", name);
        }
    });

    Utils.message("Finished populating items list.");
};

const initialiseList = () => {
    // Items list is now complete. Finish any setup for the classes in it.

    Utils.message("Initialising items list.");

    try {
        // Get the pure config items values again to finish setting them up, now that the classes are created.
        const itemConfigs = yaml.safeLoad(
            fs.readFileSync(
                path.resolve("./src/configs/ItemValues.yml"), "utf8",
            ),
        );

        itemConfigs.forEach((config) => {
            // console.log("loading item config:", config);
            if (!config.code) {
                Utils.error("Item config missing type code:", config);
            }

            if (ItemsList.BY_CODE[config.code]) {
                Utils.error(`Cannot initialise item for code "${config.code}", as it already exists in the items list. Item codes must be unique.`);
            }

            ItemsList.BY_NAME[config.name].loadConfig(config);
            // Add a reference to the item by its type code.
            ItemsList.BY_CODE[config.code] = ItemsList.BY_NAME[config.name];
        });
    }
    catch (error) {
        Utils.error(error);
    }

    Utils.message("Finished initialising items list. ItemsList is ready to use.");
};

const createCatalogue = () => {
    // Write the registered item types to the client, so the client knows what item to add for each type number.
    let dataToWrite = {};

    Object.values(ItemsList.BY_NAME).forEach((ItemType) => {
        const itemPrototype = ItemType.prototype;
        // Catches the LIST reference thing that is set up at the end of server init, which won't have a type number at all.
        if (itemPrototype === undefined) return;
        // Only add registered types.
        if (!itemPrototype.typeCode) return;
        // Add this item type to the type catalogue.
        dataToWrite[itemPrototype.typeCode] = {
            typeCode: itemPrototype.typeCode,
            translationID: ItemType.translationID,
            iconSource: ItemType.iconSource,
            soundType: ItemType.soundType,
        };
    });

    dataToWrite = JSON.stringify(dataToWrite);

    Utils.checkClientCataloguesExists();

    // Write the data to the file in the client files.
    fs.writeFileSync("../client/src/catalogues/ItemTypes.json", dataToWrite);

    Utils.message("Item types catalogue written to file.");
};

module.exports = {
    populateList,
    initialiseList,
    createCatalogue,
};
