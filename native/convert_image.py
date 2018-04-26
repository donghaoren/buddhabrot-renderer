from PIL import Image

rawData = open("output.raw", 'rb').read()
import math

sz = int(math.sqrt((len(rawData) / 4)))
imgSize = (sz, sz)
# Use the PIL raw decoder to read the data.
# the 'F;16' informs the raw decoder that we are reading 
# a little endian, unsigned integer 16 bit data.
img = Image.frombytes('RGBA', imgSize, rawData, 'raw')
img.save("foo.png")
