# Extension Icons

You need to add three icon files here:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)  
- icon128.png (128x128 pixels)

You can use any icon generator or create simple ones with any image editor.

For quick testing, you can use emoji-to-icon converters online:
- https://favicon.io/emoji-favicons/
- Choose a robot emoji 🤖
- Download and rename files appropriately

Or use ImageMagick to create simple placeholder icons:
```bash
convert -size 16x16 xc:blue -pointsize 12 -fill white -gravity center -annotate +0+0 "AC" icon16.png
convert -size 48x48 xc:blue -pointsize 32 -fill white -gravity center -annotate +0+0 "AC" icon48.png
convert -size 128x128 xc:blue -pointsize 96 -fill white -gravity center -annotate +0+0 "AC" icon128.png
```
