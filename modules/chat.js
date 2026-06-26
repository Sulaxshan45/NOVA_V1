import { db, storage } from '../utils/firebase.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

import { openModal, closeModal, showToast } from '../utils/ui.js';

let currentChatCompany = null;
let unsubChat = null;

export function renderChat() {
    const container = document.getElementById('section-chat');
    if (!container) return;

    const stored = localStorage.getItem('nova_session_user');
    if (!stored) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>Please log in</h3><p>You must be logged in to use Team Chat.</p></div>`;
        return;
    }
    const currentUser = JSON.parse(stored);
    const companies = currentUser.companies || [currentUser.company || 'Global Workspace'];
    
    if (!currentChatCompany || !companies.includes(currentChatCompany)) {
        currentChatCompany = companies[0];
    }

    // Simple check if user is a Manager/Admin
    const isManager = currentUser.designation && (
        currentUser.designation.toLowerCase().includes('manager') || 
        currentUser.designation.toLowerCase().includes('director') ||
        currentUser.designation.toLowerCase().includes('admin')
    );

    const companyTabsHtml = companies.length > 1 ? `
        <div style="display:flex; gap:8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px;">
            ${companies.map(c => `
                <button class="btn ${c === currentChatCompany ? 'btn-primary' : 'btn-ghost'} chat-tab-btn" data-company="${escapeHtml(c)}" style="border-radius: 20px; padding: 6px 16px; font-size: 13px; white-space: nowrap;">
                    ${escapeHtml(c)}
                </button>
            `).join('')}
        </div>
    ` : '';

    container.innerHTML = `
      <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap: 12px;">
           <div style="position: relative; display: inline-block;">
               <img id="chat-group-logo" src="https://via.placeholder.com/40" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent); cursor: ${isManager ? 'pointer' : 'default'};">
               ${isManager ? `<label for="chat-logo-upload" style="position: absolute; bottom: -2px; right: -4px; background: var(--accent); border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; color: white; border: 2px solid var(--bg-card);">✏️</label><input type="file" id="chat-logo-upload" accept="image/*" style="display:none;" />` : ''}
           </div>
           <div>
               <h2 class="section-title" style="margin: 0; line-height: 1;">💬 Team Chat</h2>
               <p class="section-subtitle" style="margin: 4px 0 0 0;">${escapeHtml(currentChatCompany)}</p>
           </div>
        </div>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
           <button class="btn btn-ghost" id="btn-view-members" style="padding: 6px 12px; font-size: 13px;">👥 Members</button>
           <input type="text" id="chat-search" class="form-input" placeholder="🔍 Search messages..." style="max-width:180px; font-size:13px; padding:6px 12px; border-radius:20px;" />
           ${isManager ? `<button class="btn btn-primary" id="btn-invite-member" style="padding: 6px 12px; font-size: 13px;">👤 + Invite</button>` : ''}
        </div>
      </div>

      ${companyTabsHtml}

      <div class="chat-layout" style="display: flex; height: calc(100vh - ${companies.length > 1 ? '210px' : '160px'}); gap: 16px; margin-top: ${companies.length > 1 ? '0' : '16px'};">
         <div class="chat-main" style="flex: 1; display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; position: relative;">
            
            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div style="text-align:center; color: var(--text-muted); margin-top: auto;">Loading messages...</div>
            </div>

            <div class="chat-input-area" style="padding: 16px; border-top: 1px solid var(--border); display: flex; gap: 12px; align-items: center; background: var(--bg-card);">
               <button class="btn btn-icon" id="btn-chat-attach" style="color:var(--text-muted)" title="Attach File">📎</button>
               <input type="file" id="chat-file-input" style="display:none;" />
               <input type="text" id="chat-input" class="form-input" style="flex: 1;" placeholder="Type a message... Use @ to mention a task" autocomplete="off" />
               <button class="btn btn-primary" id="btn-chat-send" style="min-width: 80px;">Send ↗</button>
            </div>
         </div>
      </div>
    `;

    initChatListener(currentChatCompany);

    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentChatCompany = e.target.dataset.company;
            document.querySelectorAll('.chat-tab-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-ghost');
            });
            e.target.classList.remove('btn-ghost');
            e.target.classList.add('btn-primary');
            
            const subtitle = document.querySelector('.section-subtitle');
            if (subtitle) subtitle.textContent = currentChatCompany;

            initChatListener(currentChatCompany);
            loadGroupProfile(currentChatCompany);
        });
    });

    // Task Mentions Logic
    const chatInput = document.getElementById('chat-input');
    let mentionPopup = document.createElement('div');
    mentionPopup.style.cssText = 'position:absolute; bottom:100%; left:20px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; display:none; max-height:150px; overflow-y:auto; width:300px; box-shadow:0 -4px 10px rgba(0,0,0,0.1); z-index:100;';
    document.querySelector('.chat-input-area').style.position = 'relative';
    document.querySelector('.chat-input-area').appendChild(mentionPopup);

    chatInput?.addEventListener('input', async (e) => {
        const val = e.target.value;
        const match = val.match(/@([a-zA-Z0-9_-]*)$/);
        
        if (match) {
            const queryText = match[1].toLowerCase();
            const q = query(collection(db, 'users'), where('companies', 'array-contains', currentChatCompany));
            const qs = await getDocs(q);
            const members = qs.docs.map(doc => doc.data());
            
            const filtered = members.filter(m => m.name.toLowerCase().includes(queryText) || (m.username && m.username.toLowerCase().includes(queryText))).slice(0, 5);
            
            if (filtered.length > 0) {
                mentionPopup.innerHTML = filtered.map(m => `
                   <div class="mention-item" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 13px;">
                      <span style="font-weight:bold;">${escapeHtml(m.name)}</span>
                      <div style="font-size:11px; color:var(--text-muted)">@${escapeHtml(m.username || 'user')}</div>
                   </div>
                `).join('');
                mentionPopup.style.display = 'block';
                
                mentionPopup.querySelectorAll('.mention-item').forEach((item, idx) => {
                    item.addEventListener('click', () => {
                        const userName = filtered[idx].name;
                        const newVal = val.replace(/@([a-zA-Z0-9_-]*)$/, `@"${userName}" `);
                        chatInput.value = newVal;
                        mentionPopup.style.display = 'none';
                        chatInput.focus();
                    });
                });
            } else {
                mentionPopup.style.display = 'none';
            }
        } else {
            mentionPopup.style.display = 'none';
        }
    });

    // Event Listeners
    document.getElementById('btn-chat-send')?.addEventListener('click', () => {
        mentionPopup.style.display = 'none';
        sendMessage(currentUser, currentChatCompany);
    });
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            mentionPopup.style.display = 'none';
            sendMessage(currentUser, currentChatCompany);
        }
    });
    
    document.getElementById('btn-chat-attach')?.addEventListener('click', () => {
        document.getElementById('chat-file-input')?.click();
    });
    
    document.getElementById('chat-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFileAndSend(file, currentUser, currentChatCompany);
        e.target.value = ''; // Reset
    });

    loadGroupProfile(currentChatCompany);

    document.getElementById('btn-view-members')?.addEventListener('click', () => {
        showMembersModal(currentUser, currentChatCompany, isManager);
    });

    document.getElementById('chat-logo-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const img = document.getElementById('chat-group-logo');
        img.style.opacity = '0.5';
        try {
            const compressed = await compressImage(file, 400); 
            const fileRef = ref(storage, `companies/${currentChatCompany}/logo_${Date.now()}`);
            await uploadBytes(fileRef, compressed);
            const url = await getDownloadURL(fileRef);
            await setDoc(doc(db, 'company_profiles', currentChatCompany), { logoUrl: url }, { merge: true });
            img.src = url;
            showToast('Group logo updated', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to upload logo', 'error');
        } finally {
            img.style.opacity = '1';
        }
    });

    if (isManager) {
        document.getElementById('btn-invite-member')?.addEventListener('click', () => showInviteModal(currentUser));
    }
    document.getElementById('chat-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const messages = document.querySelectorAll('.chat-message-item');
        messages.forEach(msg => {
            if (msg.innerText.toLowerCase().includes(query)) {
                msg.style.display = 'flex';
            } else {
                msg.style.display = 'none';
            }
        });
    });
}



function initChatListener(company) {
    if (unsubChat) unsubChat();
    
    // We listen to the specific company's chat
    const messagesRef = collection(db, 'companies', company, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    unsubChat = onSnapshot(q, (snapshot) => {
        const msgContainer = document.getElementById('chat-messages');
        if (!msgContainer) return;
        
        if (snapshot.empty) {
            msgContainer.innerHTML = `
              <div style="text-align:center; color: var(--text-muted); margin: auto;">
                <div style="font-size: 40px; margin-bottom: 12px;">👋</div>
                No messages yet. Start the conversation!
              </div>`;
            return;
        }

        msgContainer.innerHTML = '';
        const stored = localStorage.getItem('nova_session_user');
        const currentUser = stored ? JSON.parse(stored) : {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const isMe = data.senderId === currentUser.id;
            
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--accent)' : 'var(--bg-body)';
            const color = isMe ? '#fff' : 'var(--text)';
            
            const time = data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...';

            let msgText = escapeHtml(data.text);
            
            // Parse Markdown links e.g. [Image: filename.jpg](url) or [File: filename.pdf](url)
            msgText = msgText.replace(/\[Image: (.*?)\]\((.*?)\)/g, '<br><a href="$2" target="_blank"><img src="$2" style="max-width:200px; border-radius:8px; margin-top:8px;"/></a>');
            msgText = msgText.replace(/\[File: (.*?)\]\((.*?)\)/g, '<br><a href="$2" target="_blank" style="color:#0af; text-decoration:underline;">📎 $1</a>');
            
            // Parse Task Mentions e.g. @"Foundation Work"
            msgText = msgText.replace(/@&quot;(.*?)&quot;/g, '<span style="color:var(--accent); font-weight:bold; background:rgba(0,102,255,0.1); padding:2px 6px; border-radius:12px; cursor:pointer;" title="Task Mention">@$1</span>');

            msgContainer.innerHTML += `
               <div class="chat-message-item" style="display: flex; flex-direction: column; align-items: ${align}; max-width: 80%; align-self: ${align}; animation: fadeIn 0.3s ease;">
                  <span style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; padding: 0 4px;">
                    ${isMe ? 'You' : data.senderName} • ${time}
                  </span>
                  <div style="background: ${bg}; color: ${color}; padding: 12px 16px; border-radius: 16px; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); line-height: 1.5; word-break: break-word;">
                     ${msgText}
                  </div>
               </div>
            `;
        });
        
        // Auto-scroll to bottom
        setTimeout(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 50);
    });
}

async function sendMessage(user, company) {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    
    try {
        await addDoc(collection(db, 'companies', company, 'messages'), {
            text: text,
            senderId: user.id,
            senderName: user.name,
            senderUsername: user.username || '',
            createdAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Send message error", err);
        showToast("Failed to send message", "error");
    }
}

async function uploadFileAndSend(file, user, company) {
    const attachBtn = document.getElementById('btn-chat-attach');
    const originalText = attachBtn.innerHTML;
    attachBtn.innerHTML = '⏳';
    attachBtn.disabled = true;

    const msgContainer = document.getElementById('chat-messages');
    let tempId = 'temp_' + Date.now();
    if (msgContainer) {
        msgContainer.insertAdjacentHTML('beforeend', `
           <div id="${tempId}" class="chat-message-item" style="display: flex; flex-direction: column; align-items: flex-end; max-width: 80%; align-self: flex-end; opacity: 0.5;">
              <span style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; padding: 0 4px;">You • Uploading...</span>
              <div id="${tempId}_content" style="background: var(--accent); color: #fff; padding: 12px 16px; border-radius: 16px; font-size: 14px;">
                 📎 ${file.name}
              </div>
           </div>
        `);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const contentEl = document.getElementById(tempId + '_content');
                if (contentEl) {
                    contentEl.innerHTML = `<img src="${ev.target.result}" style="max-width:200px; border-radius:8px;"/><br><span style="font-size:11px;">Uploading...</span>`;
                    msgContainer.scrollTop = msgContainer.scrollHeight;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    try {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
            fileToUpload = await compressImage(file);
        }

        const fileRef = ref(storage, `companies/${company}/chat/${Date.now()}_${fileToUpload.name}`);
        await uploadBytes(fileRef, fileToUpload);
        const url = await getDownloadURL(fileRef);

        const isImage = file.type.startsWith('image/');
        const text = isImage 
           ? `[Image: ${file.name}](${url})`
           : `[File: ${file.name}](${url})`;

        await addDoc(collection(db, 'companies', company, 'messages'), {
            text: text,
            senderId: user.id,
            senderName: user.name,
            senderUsername: user.username || '',
            createdAt: serverTimestamp(),
            fileUrl: url,
            fileName: file.name,
            fileType: file.type
        });

    } catch (err) {
        console.error("Upload error", err);
        showToast("Failed to upload file", "error");
    } finally {
        attachBtn.innerHTML = originalText;
        attachBtn.disabled = false;
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();
    }
}

function showInviteModal(currentUser) {
    const html = `
        <div style="text-align:center; margin-bottom: 16px;">
           <div style="font-size: 40px; margin-bottom: 8px;">🤝</div>
           <p style="color: var(--text-muted); font-size: 14px;">Invite existing NOVA users to join <b>${currentUser.company}</b>.</p>
        </div>
        <div class="form-group">
           <label class="form-label">Search by Username</label>
           <input type="text" id="invite-username" class="form-input" placeholder="e.g. johndoe123" />
        </div>
        <button class="btn btn-primary" id="btn-confirm-invite" style="margin-top: 24px; width: 100%; padding: 14px;">Invite User</button>
    `;
    openModal('Add to Company Workspace', html);
    
    setTimeout(() => {
        document.getElementById('invite-username')?.focus();
        document.getElementById('btn-confirm-invite')?.addEventListener('click', async () => {
            const uname = document.getElementById('invite-username').value.trim();
            if (!uname) {
                showToast('Please enter a username', 'error');
                return;
            }
            
            const btn = document.getElementById('btn-confirm-invite');
            btn.innerHTML = 'Searching...';
            btn.disabled = true;

            try {
                const q = query(collection(db, 'users'), where('username', '==', uname));
                const qs = await getDocs(q);
                
                if (qs.empty) {
                    showToast('User not found. Ensure they have created a NOVA account.', 'error');
                    btn.innerHTML = 'Invite User';
                    btn.disabled = false;
                    return;
                }
                
                const invitedUserDoc = qs.docs[0];
                const invitedUser = invitedUserDoc.data();
                
                // Update user's companies array
                if (!invitedUser.companies) invitedUser.companies = [invitedUser.company];
                if (!invitedUser.companies.includes(currentChatCompany)) {
                    invitedUser.companies.push(currentChatCompany);
                }
                
                await setDoc(doc(db, 'users', invitedUser.id), invitedUser);
                
                showToast(`Successfully added ${invitedUser.name} to ${currentUser.company}!`, 'success');
                closeModal();
            } catch (e) {
                console.error(e);
                showToast('Error inviting user', 'error');
                btn.innerHTML = 'Invite User';
                btn.disabled = false;
            }
        });
    }, 50);
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (!blob) {
                        resolve(file); // Fallback
                        return;
                    }
                    const newFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(newFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file); // Fallback
        };
        reader.onerror = () => resolve(file); // Fallback
    });
}

async function loadGroupProfile(company) {
    const img = document.getElementById('chat-group-logo');
    if (!img) return;
    img.src = 'https://via.placeholder.com/40'; // fallback
    try {
        const snap = await getDoc(doc(db, 'company_profiles', company));
        if (snap.exists() && snap.data().logoUrl) {
            img.src = snap.data().logoUrl;
        }
    } catch (err) {
        console.error("Error loading profile", err);
    }
}

async function showMembersModal(currentUser, company, isManager) {
    const html = `
        <div style="text-align:center; margin-bottom: 16px;">
           <div style="font-size: 40px; margin-bottom: 8px;">👥</div>
           <p style="color: var(--text-muted); font-size: 14px;">Members of <b>${escapeHtml(company)}</b></p>
        </div>
        <div id="members-list-container" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
           <div style="text-align:center; color: var(--text-muted);">Loading members...</div>
        </div>
        ${isManager ? `
        <div style="margin-top: 24px; border-top: 1px solid var(--border); padding-top: 16px; text-align: center;">
           <button class="btn btn-danger" id="btn-delete-group" style="width: 100%; padding: 12px; font-weight: bold;">🗑️ Delete Group</button>
        </div>
        ` : ''}
    `;
    openModal('Group Members', html);

    const container = document.getElementById('members-list-container');
    try {
        const q = query(collection(db, 'users'), where('companies', 'array-contains', company));
        const qs = await getDocs(q);
        const members = qs.docs.map(d => d.data());
        
        container.innerHTML = members.map(m => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-body); border-radius: 8px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${m.picture || 'https://via.placeholder.com/40'}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">${escapeHtml(m.name)} ${m.id === currentUser.id ? '(You)' : ''}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">@${escapeHtml(m.username || '')} • ${escapeHtml(m.designation || '')}</div>
                    </div>
                </div>
                ${isManager && m.id !== currentUser.id ? `<button class="btn btn-ghost btn-remove-member" data-userid="${m.id}" style="color: var(--status-red); padding: 4px 8px; font-size: 12px; border: 1px solid var(--status-red);">Remove</button>` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.btn-remove-member').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetId = e.target.dataset.userid;
                if (confirm('Are you sure you want to remove this member from the chat?')) {
                    e.target.innerHTML = '...';
                    e.target.disabled = true;
                    try {
                        const userDoc = await getDoc(doc(db, 'users', targetId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            if (userData.companies) {
                                userData.companies = userData.companies.filter(c => c !== company);
                                await setDoc(doc(db, 'users', targetId), userData);
                                showToast('Member removed', 'success');
                                closeModal();
                            }
                        }
                    } catch (err) {
                        showToast('Error removing member', 'error');
                        e.target.innerHTML = 'Remove';
                        e.target.disabled = false;
                    }
                }
            });
        });

        document.getElementById('btn-delete-group')?.addEventListener('click', async () => {
            if (confirm(`WARNING: This will permanently delete all chat messages in ${company} and remove it for all members. This cannot be undone. Type 'DELETE' to confirm.`)) {
                const input = prompt('Type DELETE to confirm:');
                if (input === 'DELETE') {
                    showToast('Deleting group...', 'info');
                    closeModal();
                    try {
                        // 1. Remove company from all members
                        for (const m of members) {
                            if (m.companies) {
                                m.companies = m.companies.filter(c => c !== company);
                                await setDoc(doc(db, 'users', m.id), m);
                            }
                        }
                        // 2. Delete messages (fetch all and delete)
                        const msgsQ = query(collection(db, 'companies', company, 'messages'));
                        const msgsQS = await getDocs(msgsQ);
                        for (const msgDoc of msgsQS.docs) {
                            await deleteDoc(msgDoc.ref);
                        }
                        
                        // Local update for current user
                        if (currentUser.companies) {
                            currentUser.companies = currentUser.companies.filter(c => c !== company);
                            localStorage.setItem('nova_session_user', JSON.stringify(currentUser));
                            location.reload(); // Reload to refresh state completely
                        }
                    } catch (err) {
                        console.error(err);
                        showToast('Error deleting group', 'error');
                    }
                }
            }
        });

    } catch (err) {
        container.innerHTML = `<div style="text-align:center; color: var(--status-red);">Failed to load members</div>`;
    }
}
