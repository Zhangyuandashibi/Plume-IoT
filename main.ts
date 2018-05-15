


/**
 * 使用蓝牙发送和接受字符串或者数字
 * 
 * 
 */
//% color=#ee0000 weight=35 icon= "" block="Plume-IoT"
namespace Plume_IoT {
    let delimiter = "^";
    let terminator = "#";
    let handlers: LinkedKeyHandlerList = null;

    class LinkedKeyHandlerList {
        key: string;
        type: ValueTypeIndicator;
        callback: (value: TypeContainer) => void;
        next: LinkedKeyHandlerList
    }

    enum ValueTypeIndicator { String, Number }

    export class TypeContainer {
        stringValue: string;
        numberValue: number;
    }

    let messageContainer = new TypeContainer;


    /**
     * 在连接蓝牙的情况，验证密码，正确后可接收到的信息，返回一个字符串
     */
    //% mutate=objectdestructuring
    //% mutateText="My Arguments"
    //% mutateDefaults="key,stringValue"
    //% blockId=Plume-IoT_on_string_recieved
    //% weight = 34 
    //% block="接收到的信息|密钥值 %theKey|字符串值 "
    export function onStringReceived(key: string, callback: (stringValue: TypeContainer) => void) {
        let newHandler = new LinkedKeyHandlerList()
        newHandler.callback = callback;
        newHandler.type = ValueTypeIndicator.String;
        newHandler.key = key;
        newHandler.next = handlers;
        handlers = newHandler;
    }

    //% mutate=objectdestructuring
    //% mutateText="My Arguments"
    //% mutateDefaults="key,numberValue"
    //% blockId=Plume-IoT_on_number_received
    //% block="接受到的数字|密钥值 %theKey|数字值"
    //% weight = 33
    export function onNumberReceived(key: string, callback: (numberValue: TypeContainer) => void) {
        let newHandler = new LinkedKeyHandlerList()
        newHandler.callback = callback;
        newHandler.type = ValueTypeIndicator.Number;
        newHandler.key = key;
        newHandler.next = handlers;
        handlers = newHandler;
    }
    /**
     * 在连接蓝牙的情况下，发送一个字符串。
     */
    //% weight = 32
    //% blockId=Plume-IoT_send_string_key_value block="发送一个字符串|key %key|发送值 %value"
    export function sendMessageWithStringValue(key: string, value: string): void {
        sendRawMessage(key, ValueTypeIndicator.String, value)
    }
    /**
     * 在连接蓝牙的情况下，发送一串数字。
     */
    //% weight = 31
    //% blockGap=50
    //% blockId=Plume-IoT_send_number_key_value block="发送一串数字|key %key|数字值 %value"
    export function sendMessageWithNumberValue(key: string, value: number): void {
        sendRawMessage(key, ValueTypeIndicator.Number, value.toString())
    }

    function sendRawMessage(key: string, valueTypeIndicator: ValueTypeIndicator, value: string): void {
        let indicatorAsString = getStringForValueTypeIndicator(valueTypeIndicator);
        bluetooth.uartWriteString(indicatorAsString + delimiter + key + delimiter + value + terminator)
    }

    let firstOccurenceOfCharacterInString = (charToFind: string, input: string) => {
        for (let index = 0; index < input.length; index++) {
            if (input.charAt(index) == charToFind) {
                return index
            }
        }
        return - 1
    }

    let secondOccurrenceOfCharacterInString = (charToFind: string, input: string) => {
        let firstIndex = 0;
        for (let index = 0; index < input.length; index++) {
            if (input.charAt(index) == charToFind) {
                firstIndex = index
            }
        }
        let newInput = input.substr(firstIndex + 1)
        for (let index = 0; index < newInput.length; index++) {
            if (input.charAt(index) == charToFind) {
                return index
            }
        }
        return 0
    }

    let extractType = (input: string) => {
        let endOfType = firstOccurenceOfCharacterInString(delimiter, input)
        if (endOfType == -1) {
            return "MISSING DELIMITER"
        } else {
            return input.substr(0, endOfType)
        }
    }

    let extractKey = (input: string) => {
        let beginningOfKey = firstOccurenceOfCharacterInString(delimiter, input)
        let endOfKey = firstOccurenceOfCharacterInString(delimiter, input.substr(beginningOfKey + 1))
        if (endOfKey == -1) {
            return "MISSING DELIMITER"
        } else {
            return input.substr(beginningOfKey + 1, endOfKey)
        }
    }

    let extractValue = (input: string) => {
        let endOfKey = firstOccurenceOfCharacterInString(delimiter, input)
        if (endOfKey == -1) {
            return "MISSING DELIMITER"
        } else {
            let s = input.substr(endOfKey + 1)
            serial.writeLine("s: " + s)
            let endOfKey2 = firstOccurenceOfCharacterInString(delimiter, s)
            serial.writeLine("eok2: " + endOfKey2)
            serial.writeLine("input: " + input)
            return input.substr(endOfKey2 + endOfKey + 2) // + 1 for each string
        }
    }

    /**
     * Get string representation of enum.
     */
    function getStringForValueTypeIndicator(vti: ValueTypeIndicator) {
        switch (vti) {
            case ValueTypeIndicator.Number:
                return "N"
            case ValueTypeIndicator.String:
                return "S"
            default:
                return "!"
        }
    }

    /**
     * Get enum representation of string.
     */
    function getValueTypeIndicatorForString(typeString: string) {
        switch (typeString) {
            case "S":
                return ValueTypeIndicator.String
            case "N":
                return ValueTypeIndicator.Number
            default:
                return null
        }
    }

    /**
     * Handles any incoming message
     */
    export function handleIncomingUARTData() {
        let latestMessage = bluetooth.uartReadUntil(terminator)

        serial.writeLine(latestMessage)

        let t = getValueTypeIndicatorForString(extractType(latestMessage))
        serial.writeLine(getStringForValueTypeIndicator(t))

        let key = extractKey(latestMessage)
        serial.writeLine(key)
        let val = extractValue(latestMessage)
        serial.writeLine(val)

        if (t === ValueTypeIndicator.Number) {
            messageContainer.numberValue = parseInt(val)
        } else if (t === ValueTypeIndicator.String) {
            messageContainer.stringValue = val
        } else {
            messageContainer.stringValue = val
        }

        let handlerToExamine = handlers;

        if (handlerToExamine == null) { //empty handler list
            basic.showString("nohandler")
        }

        while (handlerToExamine != null) {
            if (handlerToExamine.key == key && handlerToExamine.type == t) {
                handlerToExamine.callback(messageContainer)
            }
            handlerToExamine = handlerToExamine.next
        }
    }

    bluetooth.startUartService()
    basic.forever(() => {
        Plume_IoT.handleIncomingUARTData()
    })
}


/**
 * RGB和电机驱动和超声波
 * 
 */
//% color="#ee0000" weight=30 icon="" block="Plume-IoT"
namespace Plume_IoT {

    const STP_CHA_L = 2047
    const STP_CHA_H = 4095

    const STP_CHB_L = 1
    const STP_CHB_H = 2047

    const STP_CHC_L = 1023
    const STP_CHC_H = 3071

    const STP_CHD_L = 3071
    const STP_CHD_H = 1023

    let neoStrip: neopixel.Strip;

    export enum Motors {
        M1A = 0x1,
        M1B = 0x2,
        M2A = 0x3,
        M2B = 0x4
    }

    export enum Steppers {
        M1 = 0x1,
        M2 = 0x2
    }

    export enum Turns {
        //% blockId="T1B4" block="1/4"
        T1B4 = 90,
        //% blockId="T1B2" block="1/2"
        T1B2 = 180,
        //% blockId="T1B0" block="1"
        T1B0 = 360,
        //% blockId="T2B0" block="2"
        T2B0 = 720,
        //% blockId="T3B0" block="3"
        T3B0 = 1080,
        //% blockId="T4B0" block="4"
        T4B0 = 1440,
        //% blockId="T5B0" block="5"
        T5B0 = 1800
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        let buf = pins.createBuffer(5);
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
    }


    function setStepper(index: number, dir: boolean): void {
        if (index == 1) {
            if (dir) {
                setPwm(0, STP_CHA_L, STP_CHA_H);
                setPwm(2, STP_CHB_L, STP_CHB_H);
                setPwm(1, STP_CHC_L, STP_CHC_H);
                setPwm(3, STP_CHD_L, STP_CHD_H);
            } else {
                setPwm(3, STP_CHA_L, STP_CHA_H);
                setPwm(1, STP_CHB_L, STP_CHB_H);
                setPwm(2, STP_CHC_L, STP_CHC_H);
                setPwm(0, STP_CHD_L, STP_CHD_H);
            }
        } else {
            if (dir) {
                setPwm(4, STP_CHA_L, STP_CHA_H);
                setPwm(6, STP_CHB_L, STP_CHB_H);
                setPwm(5, STP_CHC_L, STP_CHC_H);
                setPwm(7, STP_CHD_L, STP_CHD_H);
            } else {
                setPwm(7, STP_CHA_L, STP_CHA_H);
                setPwm(5, STP_CHB_L, STP_CHB_H);
                setPwm(6, STP_CHC_L, STP_CHC_H);
                setPwm(4, STP_CHD_L, STP_CHD_H);
            }
        }
    }

    function stopMotor(index: number) {
        setPwm((index - 1) * 2, 0, 0);
        setPwm((index - 1) * 2 + 1, 0, 0);
    }
    /**
     * 驱动其中一个步进电机转动一定角度
     */
    //% blockId=Plume_IoT_stepper_degree block="驱动步进电机转动|%index|角度 %degree"
    //% weight=29
    export function StepperDegree(index: Steppers, degree: number): void {
        setStepper(index, degree > 0);
        degree = Math.abs(degree);
        basic.pause(10240 * degree / 360);
        MotorStopAll()
    }

    /**
     * 驱动步进电机转动一定圈数
     */
    //% blockId=Plume_IoT_stepper_turn block="驱动步进电机转动|%index|圈 %turn"
    //% weight=28
    export function StepperTurn(index: Steppers, turn: Turns): void {
        let degree = turn;
        StepperDegree(index, degree);
    }

    /**
     * 同时驱动两个步进电机转动一定角度
     */
    //% blockId=Plume_IoT_stepper_dual block="同时驱动两个步进电机转动 |M1转动 %degree1|角度 M2转动 %degree2|角度"
    //% weight=27
    export function StepperDual(degree1: number, degree2: number): void {
        setStepper(1, degree1 > 0);
        setStepper(2, degree2 > 0);
        degree1 = Math.abs(degree1);
        degree2 = Math.abs(degree2);
        basic.pause(10240 * Math.min(degree1, degree2) / 360);
        if (degree1 > degree2) {
            stopMotor(3); stopMotor(4);
            basic.pause(10240 * (degree1 - degree2) / 360);
        } else {
            stopMotor(1); stopMotor(2);
            basic.pause(10240 * (degree2 - degree1) / 360);
        }

        MotorStopAll()
    }

    /**
     * 驱动其中一个电机转动，速度最大为255，正负表示正反转方向
     * 
     */
    //% blockId=Plume_IoT_motor_run block="电机|%index|转速 %speed"
    //% weight=26
    //% speed.min=-255 speed.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRun(index: Motors, speed: number): void {
        speed = speed * 16; // map 255 to 4096
        if (speed >= 4096) {
            speed = 4095
        }
        if (speed <= -4096) {
            speed = -4095
        }
        if (index > 4 || index <= 0)
            return
        let pp = (index - 1) * 2
        let pn = (index - 1) * 2 + 1
        if (speed >= 0) {
            setPwm(pp, 0, speed)
            setPwm(pn, 0, 0)
        } else {
            setPwm(pp, 0, 0)
            setPwm(pn, 0, -speed)
        }
    }



	/**
	 * 同时驱动两个电机一起转动
	 * @param motor1 First Motor; eg: M1A, M1B
	 * @param speed1 [-255-255] speed of motor; eg: 150, -150
	 * @param motor2 Second Motor; eg: M2A, M2B
	 * @param speed2 [-255-255] speed of motor; eg: 150, -150
	*/
    //% blockId=Plume_IoT_motor_dual block="电机|%motor1|转速 %speed1|%motor2|转速 %speed2"
    //% weight=25
    //% speed1.min=-255 speed1.max=255
    //% speed2.min=-255 speed2.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRunDual(motor1: Motors, speed1: number, motor2: Motors, speed2: number): void {
        MotorRun(motor1, speed1);
        MotorRun(motor2, speed2);
    }

	/**
	 * 延时驱动其中一个电机转动，速度在-255到255之间。
	 * @param index Motor Index; eg: M1A, M1B, M2A, M2B
	 * @param speed [-255-255] speed of motor; eg: 150, -150
	 * @param delay seconde delay to stop; eg: 1
	*/
    //% blockId=Plume_IoT_motor_rundelay block="电机|%index|转速 %speed|延迟时间 %delay|s"
    //% weight=24
    //% speed.min=-255 speed.max=255
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRunDelay(index: Motors, speed: number, delay: number): void {
        MotorRun(index, speed);
        basic.pause(delay * 1000);
        MotorRun(index, 0);
    }


    /**
     * 停止其中一个电机转动。
     */
    //% blockId=Plume_IoT_stop block="停止电机|%index|"
    //% weight=23
    export function MotorStop(index: Motors): void {
        MotorRun(index, 0);
    }


    /**
     * 停止当前所有的电机转动
     */
    //% blockId=Plume_IoT_stop_all block="停止全部电机"
    //% weight=22
    //% blockGap=30
    export function MotorStopAll(): void {
        for (let idx = 1; idx <= 4; idx++) {
            stopMotor(idx);
        }
    }

    /**
      * 使用板载的12个rgb彩灯
      */
    //% blockId="Plume_IoT_rgb" block="使用RGB"
    //% weight=21
    export function rgb(): neopixel.Strip {
        if (!neoStrip) {
            neoStrip = neopixel.create(DigitalPin.P8, 12, NeoPixelMode.RGB)
        }
        return neoStrip;
    }

    /**
       * 发射一个超声波，并且获取当前距离，并返回一串数字。
       * 注意：超声波测量盲区距离在0-4厘米，在测量距离小于盲区距离时，返回值为0.
    */
    //%icon="" weight=20
    //% blockId=Plume_IoT_ping block="获取距离 "
    export function ping(maxCmDistance = 500): number {
        // send pulse
        pins.setPull(DigitalPin.P6, PinPullMode.PullNone);
        pins.digitalWritePin(DigitalPin.P6, 0);
        control.waitMicros(2);
        pins.digitalWritePin(DigitalPin.P6, 1);
        control.waitMicros(10);
        pins.digitalWritePin(DigitalPin.P6, 0);

        // read pulse
        const d = pins.pulseIn(DigitalPin.P7, PulseValue.High, maxCmDistance * 58);
        return d *63/2320

    }


    /**
       * 读取当前环境音量，返回一个数字，单位：分贝。
    */
    //%icon="" weight=19
    //% blockId=Plume_IoT_ReadNoise block="获取音量值 "
    export function ReadNoise(): number {
        let level = 0
        let voltage = 0
        let noise = 0
        let analog_0 = 0
        let h = 0
        let l = 0
        let sumh = 0
        let suml = 0
        analog_0 = pins.analogReadPin(AnalogPin.P0)
        for (let i = 0; i < 1000; i++) {
            level = level + analog_0
        }
        level = level / 1000
        for (let i = 0; i < 1000; i++) {
            voltage = analog_0
            if (voltage >= level) {
                h += 1
                sumh = sumh + voltage
            } else {
                l += 1
                suml = suml + voltage
            }
        }
        if (h == 0) {
            sumh = level
        } else {
            sumh = sumh / h
        }
        if (l == 0) {
            suml = level
        } else {
            suml = suml / l
        }
        noise = sumh - suml
        if (noise <= 28) {
            noise = pins.map(
                noise,
                0,
                28,
                15,
                55
            )
        } else if (noise <= 70) {
            noise = pins.map(
                noise,
                28,
                70,
                55,
                64
            )
        } else if (noise <= 229) {
            noise = pins.map(
                noise,
                70,
                229,
                64,
                76
            )
        } else {
            noise = pins.map(
                noise,
                229,
                1023,
                76,
                120
            )
        }
        return noise;
    }

    let remind = 0
    let target = 15000
    let previous_running_time = 0
    let counter = 0
    let heart = 0
    let analog_1 = 0
    let current_running_time = 0

    /**
       * 读取心率值，测量时间为15秒。
       * 注意：在测量时，请勿移动、振动、远离传感器，以免造成太大的误差。
       * 通常收到开机的影响，第一次测量的数据不准确，为能获取测量数据的准确性，请多次测量。
    */
    //%icon="" weight=19
    //% blockId=Plume_IoT_Heart block="获取心率值 "

    export function Heart(): number {
        let zt = 1
        while (zt) {
            current_running_time = input.runningTime()
            analog_1 = pins.analogReadPin(AnalogPin.P1)
            if (remind == 0) {
                if (analog_1 >= 920) {
                    counter += 1
                    remind = 1
                    control.waitMicros(200)
                }
            }
            if (remind == 1) {
                if (analog_1 < 920) {
                    remind = 0
                    control.waitMicros(80)
                }
            }
            if (current_running_time - previous_running_time >= target) {
                counter = counter * 4
                heart = counter
                counter = 0
                zt = 0
                previous_running_time = input.runningTime()
            }
        }
        return heart
    }

}




/**
 * 定义rgb颜色
 */
enum NeoPixelColors {
    //% block=红色
    Red = 0xFF0000,
    //% block=橙色
    Orange = 0xFFA500,
    //% block=黄色
    Yellow = 0xFFFF00,
    //% block=绿色
    Green = 0x00FF00,
    //% block=蓝色
    Blue = 0x0000FF,
    //% block=靛蓝色
    Indigo = 0x4b0082,
    //% block=紫色
    Violet = 0x8a2be2,
    //% block=紫红色
    Purple = 0xFF00FF,
    //% block=白色
    White = 0xFFFFFF
}

/**
 * 定义rgb模式
 */
enum NeoPixelMode {
    //% block="RGB (GRB format)"
    RGB = 0,
    //% block="RGB+W"
    RGBW = 1,
    //% block="RGB (RGB format)"
    RGB_RGB = 2
}

/**
 * 这是一个关于怎么使用RGB灯环的库文件，
 * 注意，最大可以驱动的灯为256个，定义值为0-255.
 */
//% weight=5 color=#0000ce icon="\uf110" block="灯环"
namespace neopixel {
    //% shim=sendBufferAsm
    //% parts="neopixel"
    function sendBuffer(buf: Buffer, pin: DigitalPin) {
    }
    /**
     * A NeoPixel strip
     */
    export class Strip {
        buf: Buffer;
        pin: DigitalPin;
        // TODO: encode as bytes instead of 32bit
        brightness: number;
        start: number; // start offset in LED strip
        _length: number; // number of LEDs
        _mode: NeoPixelMode;

        /**
         *在所有LED灯上显示颜色。 
         * @param rgb RGB color of the LED
         */
        //% blockId="neopixel_set_strip_color" block="%strip|显示 %rgb=neopixel_colors|颜色" 
        //% weight=85 blockGap=8
        //% parts="neopixel"
        showColor(rgb: number) {
            this.setAllRGB(rgb);
            this.show();
        }

        /**
         * 在所有的LED上显示一圈彩虹灯，在给定的颜色范围内
         * 进行显示。
         * @param startHue the start hue value for the rainbow, eg: 1
         * @param endHue the end hue value for the rainbow, eg: 360
         */
        //% blockId="neopixel_set_strip_rainbow" block="显示彩虹在|%strip|颜色范围从 %startHue|到 %endHue"
        //% weight=85 blockGap=8
        //% parts="neopixel"
        showRainbow(startHue: number = 1, endHue: number = 360) {
            let start = neopixel.hsl(startHue, 100, 50);
            let end = neopixel.hsl(endHue, 100, 50);
            let colors = neopixel.interpolateHSL(start, end, this._length, HueInterpolationDirection.Clockwise);
            for (let i = 0; i < colors.length; i++) {
                let hsl = colors[i];
                let rgb = hsl.toRGB();
                this.setPixelColor(i, rgb)
            }
            this.show();
        }

        /**
         *显示一个柱状图，其的默认值是，最大值是
         * If `high` is 0, the chart gets adjusted automatically.
         * @param value current value to plot
         * @param high maximum value, eg: 255
         */
        //% weight=84
        //% blockId=neopixel_show_bar_graph block="%strip|显示条形图 %value |最高值为 %high" icon="\uf080" blockExternalInputs=true
        //% parts="neopixel"
        showBarGraph(value: number, high: number): void {
            if (high <= 0) {
                this.clear();
                this.setPixelColor(0, NeoPixelColors.Yellow);
                this.show();
                return;
            }

            value = Math.abs(value);
            const n = this._length;
            const n1 = n - 1;
            let v = (value * n) / high;
            if (v == 0) {
                this.setPixelColor(0, 0x666600);
                for (let i = 1; i < n; ++i)
                    this.setPixelColor(i, 0);
            } else {
                for (let i = 0; i < n; ++i) {
                    if (i <= v) {
                        let b = i * 255 / n1;
                        this.setPixelColor(i, neopixel.rgb(b, 0, 255 - b));
                    }
                    else this.setPixelColor(i, 0);
                }
            }
            this.show();
        }

        /**
         * 点亮给定位置的LED，并且设定它的颜色。 
         * 注意，这个块你无法单独使用，需要配合“显示”块一起使用。
         * @param pixeloffset position of the NeoPixel in the strip
         * @param rgb RGB color of the LED
         */
        //% blockId="neopixel_set_pixel_color" block="在|%strip|设定 %pixeloffset|号位置  显示 %rgb=neopixel_colors" 
        //% blockGap=8
        //% weight=80
        //% parts="neopixel" advanced=true
        setPixelColor(pixeloffset: number, rgb: number): void {
            this.setPixelRGB(pixeloffset, rgb);
        }

        /**
         * 对于具有RGB+W LED的灯环模式，设置其中一个LED白色的亮度。这只适用于RGB+W Neopixels。
         * @param pixeloffset position of the LED in the strip
         * @param white brightness of the white LED
         */
        //% blockId="neopixel_set_pixel_white" block="%strip|设定 %pixeloffset|号位置 设定亮度为 %white" 
        //% blockGap=8
        //% weight=80
        //% parts="neopixel" advanced=true
        setPixelWhiteLED(pixeloffset: number, white: number): void {
            if (this._mode === NeoPixelMode.RGBW) {
                this.setPixelW(pixeloffset, white);
            }
        }

        /**
         * 更新当前LED的状态，对于部分的块无法单独生效，需要加上这个块一起使用。
         */
        //% blockId="neopixel_show" block="%strip|显示" blockGap=8
        //% weight=79
        //% parts="neopixel"
        show() {
            sendBuffer(this.buf, this.pin);
        }

        /**
         * 关闭当前所有的LED灯
         * You need to call ``show`` to make the changes visible.
         */
        //% blockId="neopixel_clear" block="%strip|清除"
        //% weight=76
        //% parts="neopixel"
        clear(): void {
            const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            this.buf.fill(0, this.start * stride, this._length * stride);
        }

        /**
         * 获取当前设定的LED灯的数量。
         */
        //% blockId="neopixel_length" block="%strip|个数" blockGap=8
        //% weight=60 advanced=true
        length() {
            return this._length;
        }

        /**
         * 设置灯环的亮度。注意，这个块只是设置，不对灯环进行直接的操作。
         * @param brightness a measure of LED brightness in 0-255. eg: 255
         */
        //% blockId="neopixel_set_brightness" block="%strip|设置亮度 %brightness" blockGap=8
        //% weight=59
        //% parts="neopixel" advanced=true
        setBrightness(brightness: number): void {
            this.brightness = brightness & 0xff;
        }

        /**
         * 将当前颜色的亮度使用二次函数的方式减少亮度。
         **/
        //% blockId="neopixel_each_brightness" block="%strip|减缓亮度" blockGap=8
        //% weight=58
        //% parts="neopixel" advanced=true
        easeBrightness(): void {
            const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            const br = this.brightness;
            const buf = this.buf;
            const end = this.start + this._length;
            const mid = this._length / 2;
            for (let i = this.start; i < end; ++i) {
                const k = i - this.start;
                const ledoffset = i * stride;
                const br = k > mid ? 255 * (this._length - 1 - k) * (this._length - 1 - k) / (mid * mid) : 255 * k * k / (mid * mid);
                serial.writeLine(k + ":" + br);
                const r = (buf[ledoffset + 0] * br) >> 8; buf[ledoffset + 0] = r;
                const g = (buf[ledoffset + 1] * br) >> 8; buf[ledoffset + 1] = g;
                const b = (buf[ledoffset + 2] * br) >> 8; buf[ledoffset + 2] = b;
                if (stride == 4) {
                    const w = (buf[ledoffset + 3] * br) >> 8; buf[ledoffset + 3] = w;
                }
            }
        }

        /** 
         * 定义一个范围的LED。从第几个开始，顺位下几个灯。
         * @param start offset in the LED strip to start the range
         * @param length number of LEDs in the range. eg: 4
         */
        //% weight=89
        //% blockId="neopixel_range" block="%strip|范围从 %start|开始 设置 %length|个LED灯"
        //% parts="neopixel"
        range(start: number, length: number): Strip {
            let strip = new Strip();
            strip.buf = this.buf;
            strip.pin = this.pin;
            strip.brightness = this.brightness;
            strip.start = this.start + Math.clamp(0, this._length - 1, start);
            strip._length = Math.clamp(0, this._length - (strip.start - this.start), length);
            return strip;
        }

        /**
         * 将LED向前移动，并且熄灭前面的LED灯。
         * 注意，这个块你无法单独使用，需要配合“显示”块一起使用。
         * @param offset number of pixels to shift forward, eg: 1
         */
        //% blockId="neopixel_shift" block="%strip|向前移动 %offset|位" blockGap=8
        //% weight=40
        //% parts="neopixel"
        shift(offset: number = 1): void {
            const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            this.buf.shift(-offset * stride, this.start * stride, this._length * stride)
        }

        /**
         * 向前旋转LED。
         * 注意，这个块你无法单独使用，需要配合“显示”块一起使用。
         * @param offset number of pixels to rotate forward, eg: 1
         */
        //% blockId="neopixel_rotate" block="%strip|向前旋转 %offset|位" blockGap=8
        //% weight=39
        //% parts="neopixel"
        rotate(offset: number = 1): void {
            const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            this.buf.rotate(-offset * stride, this.start * stride, this._length * stride)
        }

        /**
         * 设置当前数据连接的引脚, 默认值为P0.
         */
        //% weight=10
        //% parts="neopixel" advanced=true
        setPin(pin: DigitalPin): void {
            this.pin = pin;
            pins.digitalWritePin(this.pin, 0);
            // don't yield to avoid races on initialization
        }

        private setBufferRGB(offset: number, red: number, green: number, blue: number): void {
            if (this._mode === NeoPixelMode.RGB_RGB) {
                this.buf[offset + 0] = red;
                this.buf[offset + 1] = green;
            } else {
                this.buf[offset + 0] = green;
                this.buf[offset + 1] = red;
            }
            this.buf[offset + 2] = blue;
        }

        private setAllRGB(rgb: number) {
            let red = unpackR(rgb);
            let green = unpackG(rgb);
            let blue = unpackB(rgb);

            const br = this.brightness;
            if (br < 255) {
                red = (red * br) >> 8;
                green = (green * br) >> 8;
                blue = (blue * br) >> 8;
            }
            const end = this.start + this._length;
            const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            for (let i = this.start; i < end; ++i) {
                this.setBufferRGB(i * stride, red, green, blue)
            }
        }
        private setAllW(white: number) {
            if (this._mode !== NeoPixelMode.RGBW)
                return;

            let br = this.brightness;
            if (br < 255) {
                white = (white * br) >> 8;
            }
            let buf = this.buf;
            let end = this.start + this._length;
            for (let i = this.start; i < end; ++i) {
                let ledoffset = i * 4;
                buf[ledoffset + 3] = white;
            }
        }
        private setPixelRGB(pixeloffset: number, rgb: number): void {
            if (pixeloffset < 0
                || pixeloffset >= this._length)
                return;

            let stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
            pixeloffset = (pixeloffset + this.start) * stride;

            let red = unpackR(rgb);
            let green = unpackG(rgb);
            let blue = unpackB(rgb);

            let br = this.brightness;
            if (br < 255) {
                red = (red * br) >> 8;
                green = (green * br) >> 8;
                blue = (blue * br) >> 8;
            }
            this.setBufferRGB(pixeloffset, red, green, blue)
        }
        private setPixelW(pixeloffset: number, white: number): void {
            if (this._mode !== NeoPixelMode.RGBW)
                return;

            if (pixeloffset < 0
                || pixeloffset >= this._length)
                return;

            pixeloffset = (pixeloffset + this.start) * 4;

            let br = this.brightness;
            if (br < 255) {
                white = (white * br) >> 8;
            }
            let buf = this.buf;
            buf[pixeloffset + 3] = white;
        }
    }

    /**
     * 设定当前的连接数据的引脚，当前使用LED的数量。
     * @param pin the pin where the neopixel is connected.
     * @param numleds number of leds in the strip, eg: 24,30,60,64
     */
    //% blockId="neopixel_create" block="信号引脚为 %pin|使用的LED为 %numleds|个 模式为%mode"
    //% weight=90 blockGap=8
    //% parts="neopixel"
    //% trackArgs=0,2
    export function create(pin: DigitalPin, numleds: number, mode: NeoPixelMode): Strip {
        let strip = new Strip();
        let stride = mode === NeoPixelMode.RGBW ? 4 : 3;
        strip.buf = pins.createBuffer(numleds * stride);
        strip.start = 0;
        strip._length = numleds;
        strip._mode = mode;
        strip.setBrightness(255)
        strip.setPin(pin)
        return strip;
    }

    /**
     * 将红色，绿色，蓝色转换为RGB颜色。
     * @param red value of the red channel between 0 and 255. eg: 255
     * @param green value of the green channel between 0 and 255. eg: 255
     * @param blue value of the blue channel between 0 and 255. eg: 255
     */
    //% weight=1
    //% blockId="neopixel_rgb" block="红 %red|绿 %green|蓝 %blue"
    //% advanced=true
    export function rgb(red: number, green: number, blue: number): number {
        return packRGB(red, green, blue);
    }

    /**
     * 获取当前颜色的RGB值
    */
    //% weight=2 blockGap=8
    //% blockId="neopixel_colors" block="%color"
    //% advanced=true
    export function colors(color: NeoPixelColors): number {
        return color;
    }

    function packRGB(a: number, b: number, c: number): number {
        return ((a & 0xFF) << 16) | ((b & 0xFF) << 8) | (c & 0xFF);
    }
    function unpackR(rgb: number): number {
        let r = (rgb >> 16) & 0xFF;
        return r;
    }
    function unpackG(rgb: number): number {
        let g = (rgb >> 8) & 0xFF;
        return g;
    }
    function unpackB(rgb: number): number {
        let b = (rgb) & 0xFF;
        return b;
    }

    /**
     * 定义 HSL（色调、饱和度、亮度）值 (hue, saturation, luminosity) format color
     */
    export class HSL {
        h: number;
        s: number;
        l: number;
        constructor(h: number, s: number, l: number) {
            this.h = h % 360;
            this.s = Math.clamp(0, 99, s);
            this.l = Math.clamp(0, 99, l);
        }

        /**
         * 改变HSL（色调、饱和度、亮度）中的H（色调）参数
         * @param hsl the HSL (hue, saturation, lightness) color
         * @param offset value to shift the hue channel by; hue is between 0 and 360. eg: 10
         */
        //% weight=1
        //% blockId="neopixel_rotate_hue" block="转移 %hsl|上的 %offset|色调"
        //% advanced=true
        rotateHue(offset: number): void {
            this.h = (this.h + offset) % 360;
        }

        /**
         * 将HSL（色调、饱和度、亮度）格式颜色转换成RGB格式颜色，注意，输入值得范围，
         * 
         * [0, 100], and l between [0, 100], and output r, g, b ranges between [0,255]
        */
        //% weight=2 blockGap=8
        //% blockId="neopixel_hsl_to_rgb" block="将|%hsl| 转换成RGB值"
        //% advanced=true
        toRGB(): number {
            //reference: https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSL
            let h = this.h;
            let s = this.s;
            let l = this.l;
            let c = (((100 - Math.abs(2 * l - 100)) * s) << 8) / 10000; //chroma, [0,255]
            let h1 = h / 60;//[0,6]
            let h2 = (h - h1 * 60) * 256 / 60;//[0,255]
            let temp = Math.abs((((h1 % 2) << 8) + h2) - 256);
            let x = (c * (256 - (temp))) >> 8;//[0,255], second largest component of this color
            let r$: number;
            let g$: number;
            let b$: number;
            if (h1 == 0) {
                r$ = c; g$ = x; b$ = 0;
            } else if (h1 == 1) {
                r$ = x; g$ = c; b$ = 0;
            } else if (h1 == 2) {
                r$ = 0; g$ = c; b$ = x;
            } else if (h1 == 3) {
                r$ = 0; g$ = x; b$ = c;
            } else if (h1 == 4) {
                r$ = x; g$ = 0; b$ = c;
            } else if (h1 == 5) {
                r$ = c; g$ = 0; b$ = x;
            }
            let m = ((l * 2 << 8) / 100 - c) / 2;
            let r = r$ + m;
            let g = g$ + m;
            let b = b$ + m;
            return packRGB(r, g, b);
        }
    }

    /**
     * 创建一个HSL（色调，饱和度，亮度）颜色
     * @param hue value of the hue channel between 0 and 360. eg: 360
     * @param sat value of the saturation channel between 0 and 100. eg: 100
     * @param lum value of the luminosity channel between 0 and 100. eg: 50
     */
    //% weight=1
    //% blockId="neopixel_hsl" block="色调 %hue|饱和度 %sat|亮度 %lum"
    //% advanced=true
    export function hsl(hue: number, sat: number, lum: number): HSL {
        return new HSL(hue, sat, lum);
    }

    export enum HueInterpolationDirection {
        Clockwise,
        CounterClockwise,
        Shortest
    }

    /**
     * Interpolates between two HSL colors
     * @param startColor the start HSL color
     * @param endColor the end HSL color
     * @param steps the number of steps to interpolate for. Note that if steps 
     *  is 1, the color midway between the start and end color will be returned.
     * @param direction the direction around the color wheel the hue should be interpolated.
     */
    //% parts="neopixel"
    //% advanced=true
    export function interpolateHSL(startColor: HSL, endColor: HSL, steps: number, direction: HueInterpolationDirection): HSL[] {
        if (steps <= 0)
            steps = 1;

        //hue
        let h1 = startColor.h;
        let h2 = endColor.h;
        let hDistCW = ((h2 + 360) - h1) % 360;
        let hStepCW = (hDistCW * 100) / steps;
        let hDistCCW = ((h1 + 360) - h2) % 360;
        let hStepCCW = -(hDistCCW * 100) / steps
        let hStep: number;
        if (direction === HueInterpolationDirection.Clockwise) {
            hStep = hStepCW;
        } else if (direction === HueInterpolationDirection.CounterClockwise) {
            hStep = hStepCCW;
        } else {
            hStep = hDistCW < hDistCCW ? hStepCW : hStepCCW;
        }
        let h1_100 = h1 * 100; //we multiply by 100 so we keep more accurate results while doing interpolation

        //sat
        let s1 = startColor.s;
        let s2 = endColor.s;
        let sDist = s2 - s1;
        let sStep = sDist / steps;
        let s1_100 = s1 * 100;

        //lum
        let l1 = startColor.l;
        let l2 = endColor.l;
        let lDist = l2 - l1;
        let lStep = lDist / steps;
        let l1_100 = l1 * 100

        //interpolate
        let colors: HSL[] = [];
        if (steps === 1) {
            colors.push(hsl(h1 + hStep, s1 + sStep, l1 + lStep));
        } else {
            colors.push(startColor);
            for (let i = 1; i < steps - 1; i++) {
                let h = (h1_100 + i * hStep) / 100 + 360;
                let s = (s1_100 + i * sStep) / 100;
                let l = (l1_100 + i * lStep) / 100;
                colors.push(hsl(h, s, l));
            }
            colors.push(endColor);
        }
        return colors;
    }
}
