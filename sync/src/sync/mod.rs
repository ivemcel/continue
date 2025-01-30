/**
这个 Rust 代码实现了一个分布式文件同步和版本控制的系统，基于 Merkle 树来对文件系统的差异进行管理和同步。它的关键功能是通过计算目录的 Merkle 树来跟踪文件系统的变化，并在不同的分支之间同步这些变化。代码涉及多个方面，包括文件缓存管理、同步时间记录、差异计算以及文件的增删操作。

代码组件和功能概述：
Tag 和路径管理：
Tag 结构体用于标识文件夹路径、分支和提供者 ID。每个 Tag 对象会与某个特定的目录和分支相关联，用于标记文件系统的状态。
path_for_tag 和 remove_seps_from_path 等函数用于根据 Tag 来生成特定的文件路径，比如用于存储标签的 .index_cache 或 .last_sync 文件。
Merkle 树与差异计算：

compute_tree_for_dir 函数计算给定目录的 Merkle 树。这是通过递归遍历目录及其文件来实现的。
diff 函数用于比较两个树的差异，确定哪些文件或目录是新增的、删除的或修改的。

磁盘缓存管理：
DiskSet 结构体封装了一个文件操作接口，用于存储文件的哈希值。它支持检查、添加和删除哈希值，并将它们持久化到文件中。
IndexCache 结构体则负责管理与特定 Tag 相关的缓存。它维护两个磁盘缓存：一个是全局缓存，另一个是与特定标签相关的缓存。
通过 add_global 和 remove_global 等方法，IndexCache 可以在缓存中添加或移除哈希值，保证只有当前标签或全局缓存中存储的文件信息是最新的。

同步和版本控制：
sync 函数是核心的同步逻辑。它根据文件的 Merkle 树计算出差异，并根据差异进行文件的添加、删除、标记等操作。
在同步过程中，sync 会根据 Merkle 树的差异更新 .index_cache 文件，记录哪些文件被标记、删除或计算。
write_sync_time 和 get_last_sync_time 函数用于记录和读取上次同步的时间，确保文件同步操作只处理自上次同步以来的变更。

标签（Tag）和版本控制：
rev_tags 文件保存了每个哈希值对应的标签列表。通过 add_global 和 global_remove 等方法，可以在这些文件中添加或删除标签。
get_rev_tags 函数返回特定哈希值关联的标签列表，帮助管理文件与标签之间的关系。

核心功能实现：
同步过程：
在 sync 函数中，首先会计算当前目录的 Merkle 树，并与上次同步的 Merkle 树进行比较，找出新增或删除的文件。
然后，它会更新缓存和 rev_tags 文件，确保所有的标签、文件和哈希值是最新的。
最后，它返回计算、删除、添加标签和移除标签的操作结果。

缓存和标签管理：
DiskSet 负责管理缓存，确保每个文件（通过哈希值表示）只被处理一次。每次同步时，都会检查文件的哈希值是否已经存在，如果存在则不再重新计算。
通过 rev_tags 文件，可以为每个文件分配标签，并在不同标签之间同步文件的变化。

主要数据结构：
DiskSet：存储文件哈希值，支持添加、删除和查找操作。
IndexCache：管理与特定标签相关的缓存，包括全局缓存和标签缓存。
Tag：表示一个文件夹的标签，包含路径、分支和提供者 ID。
Merkle 树：通过 compute_tree_for_dir 计算得到，用于跟踪目录和文件的变化。
*/

mod merkle;
use homedir::get_my_home;
use merkle::{compute_tree_for_dir, diff, hash_string};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use self::merkle::{ObjDescription, Tree};

#[derive(Clone)]
pub struct Tag<'a> {
    pub dir: &'a Path,
    pub branch: &'a str,
    pub provider_id: &'a str,
}

impl<'a> Tag<'a> {
    pub fn to_string(&self) -> String {
        return format!(
            "{}::{}::{}",
            self.dir.to_str().unwrap(),
            self.branch,
            self.provider_id
        );
    }
}

fn remove_seps_from_path(dir: &Path) -> String {
    let mut path = String::new();
    for component in dir.components() {
        path.push_str(component.as_os_str().to_str().unwrap());
    }

    // Remove leading slash
    if path.starts_with('/') || path.starts_with('\\') {
        path.remove(0);
    }
    path
}

fn path_for_tag(tag: &Tag) -> PathBuf {
    let mut path = get_my_home().unwrap().unwrap();
    path.push(".continue/index/tags");
    path.push(remove_seps_from_path(tag.dir));
    path.push(tag.branch);
    path.push(tag.provider_id);
    return path;
}

/// Stored in ~/.continue/index/.last_sync
fn get_last_sync_time(tag: &Tag) -> u64 {
    // TODO: Error handle here
    let path = path_for_tag(tag).join(".last_sync");

//     let mut file = File::open(path).unwrap();
//     let mut contents = String::new();
//     file.read_to_string(&mut contents).unwrap();

//     contents.parse::<u64>().unwrap()
// }

fn write_sync_time(tag: &Tag) {
    let path = path_for_tag(tag).join(".last_sync");

    let mut file = File::create(path).unwrap();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    file.write_all(now.to_string().as_bytes()).unwrap();
}


/// Use stat to find files since last sync time
// pub fn get_modified_files(tag: &Tag) -> Vec<PathBuf> {
//     let last_sync_time = get_last_sync_time(tag);
//     let mut modified_files = Vec::new();
//     for entry in build_walk(tag.dir) {
//         let entry = entry.unwrap();
//         let path = entry.path();
//         let metadata = path.metadata().unwrap();
//         let modified = metadata.modified().unwrap();
//     build_walk(dir)
//         .filter_map(|entry| {
//             let entry = entry.unwrap();
//             let path = entry.path();
//             let metadata = path.metadata().unwrap();
//             let modified = metadata.modified().unwrap();

//             if modified.duration_since(UNIX_EPOCH).unwrap().as_secs() > last_sync_time {
//                 Some(path.to_path_buf())
//             } else {
//                 None
//             }
//         })
//         .collect()
// }

// Merkle trees are unique to directories, even if nested, but .index_cache is shared between all

struct DiskSet {
    file: File,
}

const ITEM_SIZE: usize = 20;

impl DiskSet {
    pub fn new(path: &str) -> Self {
        let path = Path::new(path);
        if !path.exists() {
            File::create(path).unwrap();
        }

        Self {
            file: OpenOptions::new()
                .read(true)
                .write(true)
                .open(path)
                .unwrap(),
        }
    }

    pub fn contains(&mut self, item: &[u8; ITEM_SIZE]) -> bool {
        self.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        while self.file.read_exact(&mut buffer).is_ok() {
            if &buffer == item {
                return true;
            }
        }
        false
    }

    pub fn add(&mut self, item: &[u8; ITEM_SIZE]) {
        if self.contains(item) {
            return;
        }

        self.file.write_all(item).unwrap();
        self.file.flush().unwrap();
    }

    pub fn remove(&mut self, item: &[u8; ITEM_SIZE]) {
        self.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        let mut pos = 0;
        let mut found = false;
        while self.file.read_exact(&mut buffer).is_ok() {
            if &buffer == item {
                found = true;
                break;
            }
            pos = self.file.stream_position().unwrap() as usize;
        }

        if found {
            // Calculate the position of the last item
            let len = self.file.metadata().unwrap().len() as usize;
            let last_item_pos = len - ITEM_SIZE;

            // Move the last item in the file to the position of the item we want to remove
            self.file
                .seek(SeekFrom::Start(last_item_pos as u64))
                .unwrap();
            self.file.read_exact(&mut buffer).unwrap();
            self.file.seek(SeekFrom::Start(pos as u64)).unwrap();
            self.file.write_all(&buffer).unwrap();

            // Truncate the file at the position of the last item
            self.file.set_len(last_item_pos as u64).unwrap();
        }
    }
}

struct IndexCache<'a> {
    tag: Box<Tag<'a>>,
    global_cache: DiskSet,
    tag_cache: DiskSet,
}

impl<'a> IndexCache<'a> {
    fn index_cache_path_for_tag(tag: &Tag) -> PathBuf {
        let mut path = path_for_tag(tag);
        path.push(".index_cache");
        path
    }

    fn rev_tags_dir(provider_id: &str) -> PathBuf {
        let mut path = IndexCache::provider_dir(provider_id);
        path.push("rev_tags");
        return path;
    }

    fn rev_tags_path(hash: [u8; ITEM_SIZE], provider_id: &str) -> PathBuf {
        let hash_str = hash_string(hash);
        let mut path = IndexCache::rev_tags_dir(provider_id);
        // Branch by 1) first two chars of hash
        path.push(&hash_str[0..2]);
        path
    }

    fn tag_str(&self) -> String {
        return self.tag.to_string();
    }

    fn provider_dir(provider_id: &str) -> PathBuf {
        let mut path = get_my_home().unwrap().unwrap();
        path.push(".continue/index/providers");
        path.push(provider_id);
        return path;
    }

    fn new(tag: &'a Tag) -> IndexCache<'a> {
        return IndexCache {
            tag: Box::new(tag.clone()),
            global_cache: DiskSet::new(
                IndexCache::provider_dir(tag.provider_id)
                    .join(".index_cache")
                    .to_str()
                    .unwrap(),
            ),
            tag_cache: DiskSet::new(IndexCache::index_cache_path_for_tag(tag).to_str().unwrap()),
        };
    }

    // rev_tags files are just json files with the following format:
    // { "hash": ["tag1", "tag2", ...], ... }

    // TODO: You could add_bulk, remove_bulk if this gets slow
    fn read_rev_tags(&self, hash: [u8; ITEM_SIZE]) -> HashMap<String, Vec<String>> {
        let rev_tags_path = IndexCache::rev_tags_path(hash, self.tag.provider_id);
        let mut rev_tags_file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(rev_tags_path)
            .unwrap();
        let mut contents = String::new();
        rev_tags_file.read_to_string(&mut contents).unwrap();

        serde_json::from_str(&contents).unwrap_or_default()
    }

    fn write_rev_tags(&self, hash: [u8; ITEM_SIZE], rev_tags: HashMap<String, Vec<String>>) {
        let rev_tags_path = IndexCache::rev_tags_path(hash, self.tag.provider_id);
        let mut rev_tags_file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(rev_tags_path)
            .unwrap();
        let json = serde_json::to_string(&rev_tags).unwrap();

        // Rewrite the whole file
        rev_tags_file.set_len(0).unwrap();
        rev_tags_file.seek(SeekFrom::Start(0)).unwrap();
        rev_tags_file.write_all(json.as_bytes()).unwrap();
        rev_tags_file.flush().unwrap();
    }

    fn add_global(&mut self, item: &ObjDescription) {
        self.global_cache.add(&item.hash);
        self.tag_cache.add(&item.hash);

        // Add to rev_tags
        let mut rev_tags = Self::read_rev_tags(item.hash);
        let tag_str = self.tag_str();
        let hash_str = hash_string(item.hash);
        if !rev_tags.contains_key(hash_str.as_str()) {
            rev_tags.insert(hash_str.clone(), Vec::new());
        }
        rev_tags.get_mut(hash_str.as_str()).unwrap().push(tag_str);
        Self::write_rev_tags(item.hash, &rev_tags);
    }

    fn global_remove(&mut self, item: &ObjDescription) {
        self.global_cache.remove(&item.hash);
        self.tag_cache.remove(&item.hash);

        // Remove from rev_tags
        let mut rev_tags = Self::read_rev_tags(item.hash);
        let hash_str = hash_string(item.hash);
        if rev_tags.contains_key(hash_str.as_str()) {
            rev_tags.remove(hash_str.as_str());
        }
        Self::write_rev_tags(item.hash, &rev_tags);
    }

    fn local_remove(&mut self, item: &ObjDescription) {
        self.tag_cache.remove(&item.hash);

        // Remove from rev_tags
        let mut rev_tags = Self::read_rev_tags(item.hash);
        let tag_str = self.tag_str();
        let hash_str = hash_string(item.hash);
        if rev_tags.contains_key(hash_str.as_str()) {
            let tags = rev_tags.get_mut(hash_str.as_str()).unwrap();
            let index = tags.iter().position(|x| *x == tag_str).unwrap();
            tags.remove(index);
            if tags.is_empty() {
                rev_tags.remove(hash_str.as_str());
            }
        }
        Self::write_rev_tags(item.hash, &rev_tags);
    }

    fn global_contains(&mut self, hash: &[u8; ITEM_SIZE]) -> bool {
        self.global_cache.contains(hash)
    }

    // fn tag_contains(&mut self, hash: &[u8; ITEM_SIZE]) -> bool {
    //     self.tag_cache.contains(hash)
    // }

    fn get_rev_tags(hash: &[u8; ITEM_SIZE]) -> Vec<String> {
        let mut rev_tags = Self::read_rev_tags(*hash);
        let hash_str = hash_string(*hash);
        if rev_tags.contains_key(hash_str.as_str()) {
            rev_tags.remove(hash_str.as_str()).unwrap()
        } else {
            Vec::new()
        }
    }
}

pub fn sync(
    tag: &Tag,
) -> Result<
    (
        Vec<(String, String)>,
        Vec<(String, String)>,
        Vec<(String, String)>,
        Vec<(String, String)>,
    ),
    Box<dyn std::error::Error>,
> {
    // Make sure that the tag directory exists
    // Create the directory and all its parent directories if they don't exist
    fs::create_dir_all(path_for_tag(tag)).unwrap();
    if let Some(parent) = IndexCache::rev_tags_path([0; ITEM_SIZE], tag.provider_id).parent() {
        fs::create_dir_all(parent).unwrap();
    }

    let mut tree_path = path_for_tag(tag);
    tree_path.push("merkle_tree");

    let old_tree = Tree::load(&tree_path).unwrap_or_default();

    // Calculate and save new tree
    // TODO: Use modified files to speed up calculation
    // let modified_files = get_modified_files(dir, branch);
    let new_tree = compute_tree_for_dir(tag.dir, None)?;

    // Update last sync time
    write_sync_time(tag);

    // Save new tree
    new_tree.persist(&tree_path);

    // Compute diff
    let (add, remove) = diff(&old_tree, &new_tree);

    // Compute the four action types: compute, remove, add tag, remove tag,
    // transform into desired format: [(path, hash), ...],
    // and update .index_cache
    let mut index_cache = IndexCache::new(tag);

    let mut compute: Vec<(String, String)> = Vec::new();
    let mut delete: Vec<(String, String)> = Vec::new();
    let mut add_label: Vec<(String, String)> = Vec::new();
    let mut remove_label: Vec<(String, String)> = Vec::new();

    for item in add {
        if !item.is_blob {
            continue;
        }
        let path = item.path.as_str().to_string();
        let hash = hash_string(item.hash);

        // Need to specify between global and local contains
        if index_cache.global_contains(&item.hash) {
            add_label.push((path, hash));

            // Add to local cache
            index_cache.add_global(&item);
        } else {
            compute.push((path, hash));

            // Add to global and local cache
            index_cache.add_global(&item);
        }
    }

    for item in remove {
        if !item.is_blob {
            continue;
        }
        if index_cache.global_contains(&item.hash) {
            if IndexCache::get_rev_tags(&item.hash).len() <= 1 {
                // If it's cached only for this tag, remove it from the global cache as well
                index_cache.global_remove(&item);
                let hash = hash_string(item.hash);
                let path = item.path.as_str().to_string();
                delete.push((path, hash));
            } else {
                // Otherwise, remove label, remove from local cache
                index_cache.local_remove(&item);
                let hash = hash_string(item.hash);
                let path = item.path.as_str().to_string();
                remove_label.push((path, hash));
            }
        } else {
            // Should never happen
        }
    }

    Ok((compute, delete, add_label, remove_label))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{sync::merkle::ObjectHash, utils::TempDirBuilder};
    use std::fs::remove_file;

    #[test]
    fn test_disk_set() {
        let path = "testfile";
        let mut disk_set = DiskSet::new(path);

        let item1: ObjectHash = [1; ITEM_SIZE];
        let item2: ObjectHash = [20; ITEM_SIZE];
        let item3: ObjectHash = [30; ITEM_SIZE];

        // Test add and contains
        disk_set.add(&item1);
        disk_set.add(&item2);
        assert!(disk_set.contains(&item1));
        assert!(disk_set.contains(&item2));

        // Test the exact contents of the file
        disk_set.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        disk_set.file.read_exact(&mut buffer).unwrap();
        assert_eq!(buffer, item1);
        disk_set.file.read_exact(&mut buffer).unwrap();
        assert_eq!(buffer, item2);

        // Test remove
        disk_set.remove(&item1);
        assert!(!disk_set.contains(&item1));
        assert!(disk_set.contains(&item2));

        // Test one more add
        disk_set.add(&item3);
        assert!(disk_set.contains(&item3));

        // Test the length of the file
        disk_set.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        let mut count = 0;
        while disk_set.file.read_exact(&mut buffer).is_ok() {
            count += 1;
        }
        assert_eq!(count, 2);

        // Clean up
        remove_file(path).unwrap();
    }

    #[test]
    fn test_sync() {
        let ti = std::time::Instant::now();
        let tag = Tag {
            dir: Path::new("../"),
            branch: "nate/pyO3",
            provider_id: "default",
        };
        let results = sync(&tag);
        println!("Sync took {:?}", ti.elapsed());
        // Vast majority (90+%) of this time is spent in compute_tree_for_dir
    }

    #[test]
    fn test_on_vscode_extension() {
        let results = sync(&Tag {
            dir: Path::new("../extensions/vscode"),
            branch: "nate/pyO3",
            provider_id: "default",
        });
    }

    #[test]
    fn test_double_sync() {
        let ti = std::time::Instant::now();
        let results = sync(&Tag {
            dir: Path::new("../"),
            branch: "nate/pyO3",
            provider_id: "default",
        })
        .expect("Sync failed.");
        println!("First sync took {:?}", ti.elapsed());
        assert!(!results.0.is_empty());
        assert!(!results.1.is_empty());

        let ti = std::time::Instant::now();
        let results = sync(&Tag {
            dir: Path::new("../"),
            branch: "nate/pyO3",
            provider_id: "default",
        })
        .expect("Sync failed");
        println!("Second sync took {:?}", ti.elapsed());
        assert_eq!(results.0.len(), 0);
        assert_eq!(results.1.len(), 0);
    }

    #[test]
    fn test_sync_v3() {
        // Create temp directory
        let temp_dir = TempDirBuilder::new()
            .add("dir1/file1.txt", "File 1")
            .add("dir1/file2.txt", "File 2")
            .add("dir2/file3.txt", "File 3")
            .add("dir2/subdir/continue.py", "[continue for i in range(10)]")
            .add("__init__.py", "a = 5")
            .create();

        let tag = &Tag {
            dir: temp_dir.path(),
            branch: "BRANCH",
            provider_id: "default",
        };
        // Sync once
        sync(&tag).expect("Sync failed.");

        // Make changes
        let mut file = File::create(temp_dir.path().join("dir1/file1.txt")).unwrap();
        file.write_all(b"File 1 changed").unwrap();
        let mut file = File::create(temp_dir.path().join("dir2/file3.txt")).unwrap();
        file.write_all(b"File 3 changed").unwrap();

        // Sync again
        let results = sync(tag).expect("Sync failed.");

        // Check results
        assert_eq!(results.0.len(), 2);
        assert_eq!(results.1.len(), 2);
        assert_eq!(results.2.len(), 0);
        assert_eq!(results.3.len(), 0);

        // Start a new branch

        let tag2 = &Tag {
            dir: temp_dir.path(),
            branch: "BRANCH2",
            provider_id: "default",
        };
        // Sync again
        let results = sync(tag2).expect("Sync failed.");

        // Check results
        assert_eq!(results.0.len(), 0);
        assert_eq!(results.1.len(), 0);
        assert_eq!(results.2.len(), 5);
        assert_eq!(results.3.len(), 0);

        // Delete a file in this new branch
        remove_file(temp_dir.path().join("dir1/file2.txt")).unwrap();

        // Sync again
        let results = sync(tag2).expect("Sync failed.");

        // Check results
        assert_eq!(results.0.len(), 0);
        assert_eq!(results.1.len(), 0);
        assert_eq!(results.2.len(), 0);
        assert_eq!(results.3.len(), 1);
    }
}
