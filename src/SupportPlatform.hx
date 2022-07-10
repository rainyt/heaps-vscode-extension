class SupportPlatform {
	public static var list:Array<Platfrom> = [
		{
			name: "html5"
		},
		{
			name: "android"
		},
		{
			name: "ios"
		},
		{
			name: "mac"
		},
		{
			name: "window"
		},
		{
			name: "wechat",
			desc: "微信小游戏"
		}
	];
}

typedef Platfrom = {
	name:String,
	?desc:String
}
