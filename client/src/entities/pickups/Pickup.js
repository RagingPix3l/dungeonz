import Sprite from "../Sprite";

class Pickup extends Sprite {
    constructor(x, y, config) {
        super(x, y, config);

        this.setFrame(this.frameName);
        this.setScale(GAME_SCALE * (this.scaleModifier || 1));
        this.setOrigin(0.5);

        // Starts this sprite doing a bobbing in-out effect.
        _this.tweens.add({
            targets: this,
            duration: 1000,
            scale: this.scaleX * 0.8,
            ease: "Linear",
            repeat: -1,
            yoyo: true,
        });
    }
}

Pickup.prototype.frameName = null;
Pickup.prototype.scaleModifier = null;

export default Pickup;