import os
import json
import hashlib
import shutil
import subprocess
import sys

def read_new_files(input_path = "/input"):       
    files = os.listdir(input_path)
    result = dict()
    for file in files:
        if file.endswith(".mp4"):
            goal = file.split("_")[0]
            goal_meta = file.replace(".mp4", ".json")
            if not os.path.exists(os.path.join(input_path, goal_meta)):
                print(f"Cannot find {goal_meta}")
                continue
            if goal not in result:
                result[goal] = []
            result[goal].append((file, goal_meta))
    return result

def add_new_files(result: dict[str, list[tuple[str, str]]], input_path = "/input", 
                  output_path = "/output", output_meta_path = "/meta.json", version = 1):
    with open(output_meta_path, "r") as f:
        data = json.load(f)
    print("Start converting ...")
    for item in result.keys():
        if item not in data:
            data[item] = []
        for file, meta in result[item]:
            existed_file = set([f"{f['version']}_{f['filename']}" for f in data[item]])
            if f"{version}_{file}" in existed_file:
                print(f"{file} existed")
                continue
            index = len(data[item])
            new_name = hashlib.sha256(f"{item}-{index}".encode("utf-8")).hexdigest()
            os.mkdir(os.path.join(output_path, new_name))
            #convert_file(new_name, os.path.join(input_path, file), output_path)
            shutil.copy(os.path.join(input_path, file), os.path.join(output_path, new_name, f"{new_name}.mp4"))
            shutil.copy(os.path.join(input_path, meta), os.path.join(output_path, new_name, f"{new_name}.json"))
            data[item].append({
                "filename": file,
                "version": version,
                "meta": meta,
                "new_name": new_name,
                "index": index,
                "env": []
            })
    with open(output_meta_path, "w") as f:
        json.dump(data, f, indent=4)

def convert_file(filename, filepath, output_path):
    command = [
        "ffmpeg", "-i", filepath,
        "-vf", "scale=1280:720",
        "-b:v", "2500k",
        "-b:a", "96k",
        "-force_key_frames", "expr:gte(t,n_forced*3)",
        "-hls_list_size", "0",
        "-hls_key_info_file", f"/keys/key.info",
        "-f", "hls", f"{output_path}/{filename}/{filename}_720p.m3u8",
        "-vf", "scale=426:240",
        "-b:v", "400k",
        "-b:a", "96k",
        "-force_key_frames", "expr:gte(t,n_forced*3)",
        "-hls_list_size", "0",
        "-hls_key_info_file", f"/keys/key.info",
        "-f", "hls", f"{output_path}/{filename}/{filename}_240p.m3u8",
    ]
    subprocess.run(command)
    master_file_arr = ["#EXTM3U","#EXT-X-VERSION:3","#EXT-X-STREAM-INF:BANDWIDTH=744000",f"{filename}_240p.m3u8",\
        "#EXT-X-STREAM-INF:BANDWIDTH=3894000", f"{filename}_720p.m3u8"]
    master_file = "\n".join(master_file_arr)
    with open(f"{output_path}/{filename}/{filename}.m3u8", "w") as f:
        f.write(master_file)
        
def summary(meta_path):
  with open(meta_path, "r") as f:
    data = json.load(f)
  summary = {}
  sum = 0
  for item in data.keys():
    summary[item] = len(data[item])
    sum += summary[item]
    
  print(f"Total: {sum}")

  with open("summary.json", "w") as f:
    json.dump(summary, f, indent=4)
    
if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    meta_path = sys.argv[3]
    blender_version = sys.argv[4]
    result = read_new_files(input_path)
    add_new_files(result, input_path, output_path, meta_path, blender_version)
    summary(meta_path)
    print("Done")