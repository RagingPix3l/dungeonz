const Projectile = require("./Projectile");

class ProjIronSword extends Projectile {
    handleCollision(collidee) {
        this.damageCollidee(collidee);
    }
}
module.exports = ProjIronSword;

ProjIronSword.prototype.assignModHitPointConfigs();
ProjIronSword.prototype.moveRate = 200;
ProjIronSword.prototype.range = 3;
ProjIronSword.prototype.collisionType = ProjIronSword.prototype.CollisionTypes.Melee;
