"""Rebuild the README banner: python docs/assets/generate_banner.py (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def font(size, bold=False, serif=False):
    candidates = (["C:/Windows/Fonts/cambriab.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]
                  if serif else [f"C:/Windows/Fonts/{'segoeuib' if bold else 'segoeui'}.ttf",
                                 f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf"])
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


def main():
    output = Path(__file__).resolve().parent
    title, subtitle, label, small = font(48, serif=True), font(17), font(13, bold=True), font(12)
    xs = [90, 395, 700, 1005]
    labels = ["DISCOVER", "EXPLORE", "STUDY", "CHALLENGE"]
    descriptions = ["Historical events", "Illustrated 3D monuments", "AI notes + session memory", "Personalized + multiplayer quizzes"]
    frames = []
    for index in range(40):
        canvas = Image.new("RGB", (1100, 320), "#192f40")
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle((1, 1, 1098, 318), radius=16, outline="#365063", width=2)
        for x in range(820, 1060, 25):
            for y in range(35, 150, 25):
                draw.ellipse((x, y, x + 2, y + 2), fill="#314858")
        draw.rounded_rectangle((38, 30, 274, 55), radius=12, outline="#726746")
        draw.text((51, 35), "HISTORY, MADE INTERACTIVE", font=small, fill="#d6b975")
        draw.text((38, 66), "HistoFacts", font=title, fill="#f1ecdf")
        draw.text((40, 128), "Explore the past. Build understanding. Remember what matters.", font=subtitle, fill="#acbdc7")
        draw.line((40, 174, 1060, 174), fill="#365063")
        position = xs[0] + (xs[-1] - xs[0]) * index / 39
        draw.line((xs[0], 219, xs[-1], 219), fill="#365063", width=2)
        draw.line((xs[0], 219, position, 219), fill="#d6b975", width=2)
        for x, heading, description in zip(xs, labels, descriptions):
            reached = position >= x - 1
            draw.ellipse((x-7, 212, x+7, 226), fill="#192f40", outline="#d6b975" if reached else "#60727e", width=2)
            if reached:
                draw.ellipse((x-3, 216, x+3, 222), fill="#d6b975")
            draw.text((x-draw.textlength(heading, font=label)/2, 242), heading, font=label, fill="#f1ecdf")
            width = draw.textlength(description, font=small)
            draw.text((min(1065-width, max(35, x-width/2)), 265), description, font=small, fill="#acbdc7")
        draw.ellipse((position-11, 208, position+11, 230), outline="#d6b975")
        draw.ellipse((position-4, 215, position+4, 223), fill="#f1ecdf")
        frames.append(canvas)
    frames[25].save(output / "histofacts-banner.png", optimize=True)
    frames[0].save(output / "histofacts-banner.gif", save_all=True, append_images=frames[1:], duration=120,
                   loop=0, optimize=True, disposal=1)


if __name__ == "__main__":
    main()
